// Jellyfin Web: a Picture-in-Picture fallback beside the fullscreen button.
(function pictureInPictureEnhancement() {
    'use strict';

    const INSTANCE = '__jellyfinPictureInPictureEnhancement';
    if (window[INSTANCE]) return;
    window[INSTANCE] = true;

    const BUTTON_CLASS = 'jellyfin-enhancements-pip';
    const watchedVideos = new WeakSet();
    let pending = false;
    let busy = false;
    let messageTimer;

    function getVideo() {
        if (document.pictureInPictureElement) return document.pictureInPictureElement;
        return Array.from(document.querySelectorAll('video')).find(video => {
            const rect = video.getBoundingClientRect();
            return video.isConnected && rect.width > 0 && rect.height > 0;
        }) || null;
    }

    function supported(video) {
        return !!(video && document.pictureInPictureEnabled &&
            typeof video.requestPictureInPicture === 'function' &&
            typeof document.exitPictureInPicture === 'function' &&
            !video.disablePictureInPicture);
    }

    function showError() {
        let message = document.getElementById('jellyfin-enhancements-pip-message');
        if (!message) {
            message = document.createElement('div');
            message.id = 'jellyfin-enhancements-pip-message';
            message.setAttribute('role', 'status');
            message.style.cssText = 'position:fixed;bottom:6em;left:10%;right:10%;z-index:100000;' +
                'padding:1em;background:#202020;color:white;text-align:center;border-radius:.4em;';
            (document.fullscreenElement || document.body).appendChild(message);
        }
        message.textContent = 'Could not open Picture-in-Picture. Your browser or this video may not allow it.';
        clearTimeout(messageTimer);
        messageTimer = setTimeout(() => message.remove(), 6000);
    }

    async function toggle(event) {
        event.preventDefault();
        event.stopPropagation();
        if (busy) return;
        const video = getVideo();
        if (!supported(video)) return;
        busy = true;
        refresh();
        try {
            // Call directly from the click to preserve browser user activation.
            // The browser handles the transition out of fullscreen itself.
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (error) {
            console.warn('[Jellyfin Picture-in-Picture] Could not change mode:', error);
            showError();
        } finally {
            busy = false;
            refresh();
        }
    }

    function watch(video) {
        if (watchedVideos.has(video)) return;
        watchedVideos.add(video);
        for (const name of ['enterpictureinpicture', 'leavepictureinpicture',
            'loadedmetadata', 'emptied', 'playing', 'resize']) {
            video.addEventListener(name, scheduleRefresh);
        }
    }

    function refresh() {
        document.querySelectorAll('video').forEach(watch);
        const video = getVideo();
        for (const controls of document.querySelectorAll('.videoOsdBottom')) {
            const anchor = controls.querySelector('.btnFullscreen');
            if (!anchor) continue;
            const nativeButton = controls.querySelector('.btnPip');
            const nativeAvailable = nativeButton && !nativeButton.hidden &&
                !nativeButton.classList.contains('hide');
            let button = controls.querySelector('.' + BUTTON_CLASS);
            const available = supported(video) && !nativeAvailable;
            if (!button && !available) continue;
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = BUTTON_CLASS + ' paper-icon-button-light autoSize';
                const icon = document.createElement('span');
                icon.className = 'xlargePaperIconButton material-icons picture_in_picture_alt';
                icon.setAttribute('aria-hidden', 'true');
                button.appendChild(icon);
                button.addEventListener('click', toggle);
                anchor.before(button);
            }
            const active = !!document.pictureInPictureElement;
            const label = active ? 'Return to player' : 'Picture-in-Picture';
            button.hidden = !available;
            button.disabled = busy || !video || video.readyState === 0 || !video.videoWidth;
            button.title = label;
            button.setAttribute('aria-label', label);
            button.setAttribute('aria-pressed', String(active));
        }
    }

    function scheduleRefresh() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            refresh();
        });
    }

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'src', 'disablepictureinpicture']
    });
    document.addEventListener('fullscreenchange', scheduleRefresh);
    refresh();
})();
