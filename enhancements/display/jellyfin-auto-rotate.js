(() => {
    console.log("[Jellyfin Auto Rotate] Loaded");

    async function setOrientation() {
        try {
            if (document.fullscreenElement) {
                console.log("[Jellyfin Auto Rotate] Fullscreen detected");

                if (screen.orientation?.lock) {
                    await screen.orientation.lock("landscape");
                    console.log("[Jellyfin Auto Rotate] Landscape locked");
                }
            } else {
                console.log("[Jellyfin Auto Rotate] Leaving fullscreen");

                if (screen.orientation?.unlock) {
                    screen.orientation.unlock();
                    console.log("[Jellyfin Auto Rotate] Orientation unlocked");
                }
            }
        } catch (e) {
            console.warn("[Jellyfin Auto Rotate] Error:", e);
        }
    }

    document.addEventListener("fullscreenchange", setOrientation);
    document.addEventListener("webkitfullscreenchange", setOrientation);
})();