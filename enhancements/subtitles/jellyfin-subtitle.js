// Jellyfin Web subtitle enhancements
// Feature: persist subtitle offset per movie and subtitle track across playback sessions.
(function subtitleOffsetPersistence() {
    'use strict';

    const STORAGE_PREFIX = 'jellyfin-enhancements:subtitle-offset:v3';
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

    function getCurrentItemId() {
        // Some custom loaders expose the manager; standard Jellyfin builds
        // keep it private, so also inspect the active video's stream URLs.
        const manager = window.playbackManager;
        const itemId = safeIdentifier(
            () => manager?.currentItem(manager.getCurrentPlayer())?.Id,
            null
        );
        if (itemId) return itemId;

        for (const video of document.querySelectorAll('video')) {
            const sources = [
                video.currentSrc,
                video.getAttribute('src'),
                ...Array.from(video.querySelectorAll('source, track'), node => node.src)
            ];
            for (const source of sources) {
                if (!source) continue;
                try {
                    const url = new URL(source, window.location.href);
                    const match = url.pathname.match(/\/Videos\/([0-9a-f-]+)\//i);
                    if (match) return match[1].toLowerCase();
                } catch (_) {
                    // Ignore URLs that do not identify a Jellyfin video.
                }
            }
        }
        return null;
    }

    let sessionRequest = null;
    const sliderStates = new WeakMap();

    function validIndex(value) {
        return Number.isInteger(value) && value >= 0;
    }

    async function getStorageKey() {
        const apiClient = getApiClient();
        const serverId = safeIdentifier(
            () => apiClient?.serverId?.() || apiClient?._serverInfo?.Id,
            window.location.origin
        );
        const userId = safeIdentifier(
            () => apiClient?.getCurrentUserId?.() || apiClient?._serverInfo?.UserId,
            null
        );
        if (!userId) return null;

        let itemId;
        let sourceId;
        let primary;
        let secondary;
        const manager = window.playbackManager;
        try {
            const player = manager?.getCurrentPlayer();
            const item = player && manager.currentItem(player);
            if (item?.Id) {
                itemId = item.Id;
                sourceId = manager.currentMediaSource(player)?.Id;
                primary = manager.getSubtitleStreamIndex(player);
                secondary = manager.getSecondarySubtitleStreamIndex?.(player);
            }
        } catch (_) {
            // Standard builds keep the manager private. Use this device's
            // reported session instead; never use another client's selection.
        }
        if (!itemId) {
            const deviceId = safeIdentifier(() => apiClient?.deviceId(), null);
            if (!deviceId || typeof apiClient?.getSessions !== 'function') return null;
            try {
                // Share concurrent reads from the timer and the sync control.
                if (!sessionRequest) {
                    sessionRequest = Promise.resolve(apiClient.getSessions({ DeviceId: deviceId }))
                        .finally(() => { sessionRequest = null; });
                }
                const sessions = await sessionRequest;
                if (apiClient !== getApiClient() || userId !== String(apiClient.getCurrentUserId())) return null;
                const matches = sessions.filter(session =>
                    session.DeviceId === deviceId && session.UserId === userId && session.NowPlayingItem?.Id
                );
                if (matches.length !== 1) return null;
                const session = matches[0];
                itemId = session.NowPlayingItem.Id;
                sourceId = session.PlayState?.MediaSourceId;
                primary = session.PlayState?.SubtitleStreamIndex;
                secondary = session.PlayState?.SecondarySubtitleStreamIndex;
                const videoItemId = getCurrentItemId();
                if (videoItemId && videoItemId.toLowerCase() !== String(itemId).toLowerCase()) return null;
            } catch (_) {
                return null;
            }
        }
        // Off, unidentified tracks, and unknown media versions must not share
        // a preference. A stream index of zero is a valid subtitle track.
        if (!validIndex(primary) || !sourceId) return null;
        return [STORAGE_PREFIX, serverId, userId, String(itemId).toLowerCase(),
            sourceId, primary, validIndex(secondary) ? secondary : 'off']
            .map(value => encodeURIComponent(String(value))).join(':');
    }

    function normalizeOffset(value) {
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) return 0;

        const clamped = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, parsed));
        return Math.round(clamped * 10) / 10;
    }

    function loadOffset(key) {
        try {
            return normalizeOffset(localStorage.getItem(key) || 0);
        } catch (_) {
            return 0;
        }
    }

    async function saveOffset(slider, value) {
        const offset = normalizeOffset(value);
        const state = sliderStates.get(slider);
        const revision = ++state.revision;
        const key = await getStorageKey();
        if (!slider.isConnected || revision !== state.revision) return offset;
        if (!key) {
            state.key = null;
            return offset;
        }
        state.key = key;

        try {
            localStorage.setItem(key, String(offset));
        } catch (error) {
            console.warn(
                '[Jellyfin subtitle offset] Could not save preference:',
                error
            );
        }

        return offset;
    }

    async function restoreOffset(slider, force = false) {
        const state = sliderStates.get(slider);
        if (!state) return;
        const revision = state.revision;
        const key = await getStorageKey();
        if (!slider.isConnected || revision !== state.revision) return;
        if (!key) {
            state.key = null;
            return;
        }
        if (!force && state.key === key) return;
        state.key = key;
        const savedOffset = loadOffset(key);

        slider.restoringSubtitleOffset = true;
        try {
            if (typeof slider.updateOffset === 'function') {
                slider.updateOffset(savedOffset);
            } else {
                slider.value = String(savedOffset);
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } finally {
            slider.restoringSubtitleOffset = false;
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
        sliderStates.set(slider, { key: null, revision: 0 });

        // Jellyfin calls updateOffset() for keyboard/text-field changes. Wrapping
        // it captures those changes in addition to ordinary slider changes.
        if (typeof slider.updateOffset === 'function') {
            const jellyfinUpdateOffset = slider.updateOffset.bind(slider);

            slider.updateOffset = function persistentUpdateOffset(value) {
                const offset = normalizeOffset(value);
                jellyfinUpdateOffset(offset);
                if (!slider.restoringSubtitleOffset) saveOffset(slider, offset);
            };
        }

        slider.addEventListener('change', () => {
            if (!slider.restoringSubtitleOffset) saveOffset(slider, slider.value);
        });

        // Jellyfin finishes initializing this component in the same task. A
        // queued restore ensures its listeners and player reference are ready.
        queueMicrotask(() => restoreOffset(slider, true));

        const container = slider.closest(CONTAINER_SELECTOR);
        if (!container) return;

        // Jellyfin may reset the player offset when changing videos or subtitle
        // tracks. Reapply this movie's preference when the control is reopened.
        const visibilityObserver = new MutationObserver(() => {
            if (!container.classList.contains('hide')) {
                queueMicrotask(() => restoreOffset(slider, true));
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
            for (const node of mutation.addedNodes) {
                if (node instanceof Element) scan(node);
            }
        }
    });

    scan();
    // A reused player can start another movie without creating a new slider.
    document.addEventListener('loadedmetadata', (event) => {
        if (event.target instanceof HTMLVideoElement) {
            document.querySelectorAll(SLIDER_SELECTOR).forEach(slider => restoreOffset(slider, true));
        }
    }, true);
    // Session reports also cover custom subtitle renderers without DOM tracks.
    // Poll only while a sync control and video exist; reapply only on key changes.
    setInterval(() => {
        if (!document.querySelector('video')) return;
        document.querySelectorAll(SLIDER_SELECTOR).forEach(slider => restoreOffset(slider));
    }, 1500);
    documentObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    console.info(
        '[Jellyfin subtitle offset] Per-movie and subtitle-track persistence enabled.'
    );
})();
