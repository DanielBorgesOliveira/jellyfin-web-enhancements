// Jellyfin Web subtitle enhancements
// Feature: persist subtitle offset and reapply it to future playback sessions.
(function subtitleOffsetPersistence() {
    'use strict';

    const STORAGE_PREFIX = 'jellyfin-enhancements:subtitle-offset:v1';
    const SLIDER_SELECTOR = '.subtitleSyncSlider';
    const CONTAINER_SELECTOR = '.subtitleSyncContainer';
    const MIN_OFFSET = -90;
    const MAX_OFFSET = 90;
    const ENHANCED_ATTRIBUTE = 'data-offset-persistence-ready';

    function getApiClient() {
        return window.ApiClient || globalThis.ApiClient || null;
    }

    function safeIdentifier(getValue, fallback) {
        try {
            const value = getValue();
            return value ? String(value) : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function getStorageKey() {
        const apiClient = getApiClient();
        const serverId = safeIdentifier(
            () => apiClient?.serverId?.() || apiClient?._serverInfo?.Id,
            window.location.origin
        );
        const userId = safeIdentifier(
            () => apiClient?.getCurrentUserId?.() || apiClient?._serverInfo?.UserId,
            'anonymous'
        );

        return [STORAGE_PREFIX, serverId, userId].join(':');
    }

    function normalizeOffset(value) {
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) return 0;

        const clamped = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, parsed));
        return Math.round(clamped * 10) / 10;
    }

    function loadOffset() {
        try {
            return normalizeOffset(localStorage.getItem(getStorageKey()) || 0);
        } catch (_) {
            return 0;
        }
    }

    function saveOffset(value) {
        const offset = normalizeOffset(value);

        try {
            localStorage.setItem(getStorageKey(), String(offset));
        } catch (error) {
            console.warn(
                '[Jellyfin subtitle offset] Could not save preference:',
                error
            );
        }

        return offset;
    }

    function restoreOffset(slider) {
        const savedOffset = loadOffset();

        if (typeof slider.updateOffset === 'function') {
            slider.updateOffset(savedOffset);
        } else {
            slider.value = String(savedOffset);
            slider.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function enhanceSlider(slider) {
        if (
            !(slider instanceof HTMLInputElement) ||
            slider.hasAttribute(ENHANCED_ATTRIBUTE)
        ) {
            return;
        }

        slider.setAttribute(ENHANCED_ATTRIBUTE, 'true');

        // Jellyfin calls updateOffset() for keyboard/text-field changes. Wrapping
        // it captures those changes in addition to ordinary slider changes.
        if (typeof slider.updateOffset === 'function') {
            const jellyfinUpdateOffset = slider.updateOffset.bind(slider);

            slider.updateOffset = function persistentUpdateOffset(value) {
                const offset = normalizeOffset(value);
                jellyfinUpdateOffset(offset);
                saveOffset(offset);
            };
        }

        slider.addEventListener('change', () => {
            saveOffset(slider.value);
        });

        // Jellyfin finishes initializing this component in the same task. A
        // queued restore ensures its listeners and player reference are ready.
        queueMicrotask(() => restoreOffset(slider));

        const container = slider.closest(CONTAINER_SELECTOR);
        if (!container) return;

        // Jellyfin may reset the player offset when changing videos or subtitle
        // tracks. Reapply the preference whenever the sync control is reopened.
        const visibilityObserver = new MutationObserver(() => {
            if (!container.classList.contains('hide')) {
                queueMicrotask(() => restoreOffset(slider));
            }
        });

        visibilityObserver.observe(container, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    function scan(root = document) {
        if (root instanceof Element && root.matches(SLIDER_SELECTOR)) {
            enhanceSlider(root);
        }

        root.querySelectorAll?.(SLIDER_SELECTOR).forEach(enhanceSlider);
    }

    const documentObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof Element) scan(node);
            });
        }
    });

    scan();
    documentObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    console.info(
        '[Jellyfin subtitle offset] Persistence enabled. Saved offset:',
        loadOffset() + 's'
    );
})();
