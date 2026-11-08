(() => {
    console.log("[Jellyfin SwipeSeek v6] Loading...");

    // ============================================================
    // CONFIGURATION
    // ============================================================

    const PX_PER_SECOND = 6;
    const MAX_SEEK_SECONDS = 120;
    const MIN_DRAG_PX = 12;

    const PREVIEW_MAX_WIDTH = 300;
    const PREVIEW_MAX_HEIGHT = 180;

    // ============================================================
    // STATE
    // ============================================================

    let active = false;
    let horizontalGesture = false;

    let startX = 0;
    let startY = 0;

    let startTime = 0;
    let seekSeconds = 0;

    let activeVideo = null;

    let trickplayInfo = null;
    let trickplayItemId = null;
    let trickplayMediaSourceId = null;

    let lastTileUrl = null;

    // ============================================================
    // VIDEO
    // ============================================================

    function getVideo() {
        const videos = [...document.querySelectorAll("video")];

        return (
            videos.find(video => {
                const rect = video.getBoundingClientRect();
                const style = getComputedStyle(video);

                return (
                    rect.width > 50 &&
                    rect.height > 50 &&
                    style.display !== "none" &&
                    style.visibility !== "hidden"
                );
            }) || null
        );
    }

    // ============================================================
    // PLAYER CONTROL DETECTION
    //
    // SwipeSeek must NOT intercept Jellyfin's:
    // - progress bar
    // - progress pin/thumb
    // - buttons
    // - sliders
    // ============================================================

    function isPlayerControl(target) {
        if (!target || !target.closest) {
            return false;
        }

        return !!target.closest(`
            input[type="range"],
            .slider,
            .emby-slider,
            .mdl-slider,
            .osdPositionSlider,
            .positionSlider,
            .videoOsdBottom,
            .videoOsdControls,
            .seekSlider,
            .volumeSlider,
            button,
            .paper-icon-button-light,
            [role="slider"],
            [role="button"]
        `);
    }

    // ============================================================
    // CHECK WHETHER TOUCH STARTED INSIDE VIDEO
    // ============================================================

    function pointIsInsideVideo(video, x, y) {
        if (!video) return false;

        const rect = video.getBoundingClientRect();

        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    // ============================================================
    // TIME FORMAT
    // ============================================================

    function formatTime(seconds) {
        seconds = Math.max(
            0,
            Math.round(seconds)
        );

        const h =
            Math.floor(seconds / 3600);

        const m =
            Math.floor(
                (seconds % 3600) / 60
            );

        const s =
            seconds % 60;

        if (h > 0) {
            return (
                h +
                ":" +
                String(m).padStart(2, "0") +
                ":" +
                String(s).padStart(2, "0")
            );
        }

        return (
            m +
            ":" +
            String(s).padStart(2, "0")
        );
    }

    // ============================================================
    // REMOVE OLD OVERLAYS
    // ============================================================

    [
        "jellyfin-swipe-seek-overlay",
        "jellyfin-swipe-seek-v4",
        "jellyfin-swipe-seek-v5",
        "jellyfin-swipe-seek-v6"
    ].forEach(id => {
        document
            .getElementById(id)
            ?.remove();
    });

    // ============================================================
    // MAIN OVERLAY
    // ============================================================

    const overlay =
        document.createElement("div");

    overlay.id =
        "jellyfin-swipe-seek-v6";

    Object.assign(
        overlay.style,
        {
            position: "fixed",

            top: "50%",
            left: "50%",

            transform:
                "translate(-50%, -50%)",

            zIndex: "2147483647",

            display: "flex",
            flexDirection: "column",
            alignItems: "center",

            pointerEvents: "none",

            opacity: "0",

            transition:
                "opacity 0.08s ease",

            userSelect: "none",
            WebkitUserSelect: "none"
        }
    );

    // ============================================================
    // PREVIEW FRAME
    // ============================================================

    const previewFrame =
        document.createElement("div");

    Object.assign(
        previewFrame.style,
        {
            display: "none",

            overflow: "hidden",

            borderRadius: "12px",

            backgroundColor:
                "rgba(0,0,0,0.8)",

            boxShadow:
                "0 3px 15px rgba(0,0,0,0.65)",

            marginBottom: "10px"
        }
    );

    const previewImage =
        document.createElement("div");

    Object.assign(
        previewImage.style,
        {
            position: "relative",
            backgroundRepeat: "no-repeat"
        }
    );

    previewFrame.appendChild(
        previewImage
    );

    // ============================================================
    // INFO BOX
    // ============================================================

    const infoBox =
        document.createElement("div");

    Object.assign(
        infoBox.style,
        {
            background:
                "rgba(0,0,0,0.78)",

            color: "#fff",

            padding: "10px 20px",

            borderRadius: "14px",

            textAlign: "center",

            fontFamily:
                "Arial, sans-serif",

            whiteSpace: "nowrap",

            boxShadow:
                "0 2px 10px rgba(0,0,0,0.45)"
        }
    );

    const seekLabel =
        document.createElement("div");

    Object.assign(
        seekLabel.style,
        {
            fontSize: "26px",
            fontWeight: "700"
        }
    );

    const timeLabel =
        document.createElement("div");

    Object.assign(
        timeLabel.style,
        {
            fontSize: "16px",
            fontWeight: "400",
            marginTop: "3px",
            opacity: "0.92"
        }
    );

    infoBox.appendChild(
        seekLabel
    );

    infoBox.appendChild(
        timeLabel
    );

    overlay.appendChild(
        previewFrame
    );

    overlay.appendChild(
        infoBox
    );

    document.body.appendChild(
        overlay
    );

    // ============================================================
    // TARGET TIME
    // ============================================================

    function getTargetTime(video) {
        let target =
            startTime + seekSeconds;

        target =
            Math.max(
                0,
                target
            );

        if (
            Number.isFinite(
                video.duration
            )
        ) {
            target =
                Math.min(
                    video.duration,
                    target
                );
        }

        return target;
    }

    // ============================================================
    // JELLYFIN API
    // ============================================================

    function getApiClient() {
        return window.ApiClient || null;
    }

    // ============================================================
    // ITEM ID
    // ============================================================

    function getItemIdFromVideo(video) {
        const sources = [
            video.currentSrc,
            video.src
        ].filter(Boolean);

        for (const src of sources) {
            const match =
                src.match(
                    /\/Videos\/([0-9a-fA-F-]+)\//i
                );

            if (match) {
                return match[1];
            }
        }

        return null;
    }

    // ============================================================
    // MEDIA SOURCE ID
    // ============================================================

    function getMediaSourceFromVideo(
        video
    ) {
        const sources = [
            video.currentSrc,
            video.src
        ].filter(Boolean);

        for (const src of sources) {
            try {
                const url =
                    new URL(
                        src,
                        location.href
                    );

                const value =
                    url.searchParams.get(
                        "MediaSourceId"
                    );

                if (value) {
                    return value;
                }
            } catch (e) {}
        }

        return null;
    }

    // ============================================================
    // PROPERTY HELPER
    // ============================================================

    function getValue(
        obj,
        pascal,
        camel
    ) {
        if (!obj) {
            return undefined;
        }

        if (
            obj[pascal] !== undefined
        ) {
            return obj[pascal];
        }

        return obj[camel];
    }

    // ============================================================
    // LOAD TRICKPLAY DATA
    // ============================================================

    async function loadTrickplay(video) {
        trickplayInfo = null;
        trickplayItemId = null;
        trickplayMediaSourceId = null;
        lastTileUrl = null;

        const api =
            getApiClient();

        if (!api) {
            console.warn(
                "[Jellyfin SwipeSeek v6] ApiClient unavailable."
            );

            return false;
        }

        const itemId =
            getItemIdFromVideo(video);

        if (!itemId) {
            console.warn(
                "[Jellyfin SwipeSeek v6] Could not detect item ID."
            );

            return false;
        }

        try {
            const userId =
                api.getCurrentUserId();

            const item =
                await api.getItem(
                    userId,
                    itemId
                );

            if (!item) {
                return false;
            }

            const trickplay =
                item.Trickplay ||
                item.trickplay;

            if (!trickplay) {
                console.log(
                    "[Jellyfin SwipeSeek v6] No Trickplay data."
                );

                return false;
            }

            let mediaSourceId =
                getMediaSourceFromVideo(
                    video
                );

            let resolutions = null;

            if (
                mediaSourceId &&
                trickplay[mediaSourceId]
            ) {
                resolutions =
                    trickplay[
                        mediaSourceId
                    ];
            }

            if (!resolutions) {
                const sourceIds =
                    Object.keys(
                        trickplay
                    );

                if (
                    sourceIds.length === 0
                ) {
                    return false;
                }

                mediaSourceId =
                    sourceIds[0];

                resolutions =
                    trickplay[
                        mediaSourceId
                    ];
            }

            const widths =
                Object.keys(
                    resolutions
                );

            if (
                widths.length === 0
            ) {
                return false;
            }

            widths.sort(
                (a, b) =>
                    Number(a) -
                    Number(b)
            );

            let selectedWidth =
                widths[0];

            for (
                const width
                of widths
            ) {
                if (
                    Number(width) <= 640
                ) {
                    selectedWidth =
                        width;
                }
            }

            trickplayInfo =
                resolutions[
                    selectedWidth
                ];

            trickplayItemId =
                itemId;

            trickplayMediaSourceId =
                mediaSourceId;

            console.log(
                "[Jellyfin SwipeSeek v6] Trickplay ready."
            );

            return true;

        } catch (error) {
            console.warn(
                "[Jellyfin SwipeSeek v6] Trickplay error:",
                error
            );

            return false;
        }
    }

    // ============================================================
    // BUILD TRICKPLAY URL
    // ============================================================

    function getTrickplayUrl(
        width,
        tileIndex
    ) {
        const api =
            getApiClient();

        if (!api) {
            return null;
        }

        let serverAddress;

        try {
            serverAddress =
                typeof api.serverAddress ===
                "function"
                    ? api.serverAddress()
                    : api.serverAddress;
        } catch (e) {
            return null;
        }

        if (!serverAddress) {
            return null;
        }

        serverAddress =
            serverAddress.replace(
                /\/$/,
                ""
            );

        let url =
            serverAddress +
            "/Videos/" +
            encodeURIComponent(
                trickplayItemId
            ) +
            "/Trickplay/" +
            width +
            "/" +
            tileIndex +
            ".jpg";

        const params =
            new URLSearchParams();

        if (
            trickplayMediaSourceId
        ) {
            params.set(
                "MediaSourceId",
                trickplayMediaSourceId
            );
        }

        try {
            const token =
                api.accessToken();

            if (token) {
                params.set(
                    "api_key",
                    token
                );
            }
        } catch (e) {}

        const query =
            params.toString();

        if (query) {
            url +=
                "?" + query;
        }

        return url;
    }

    // ============================================================
    // SHOW TRICKPLAY PREVIEW
    // ============================================================

    function showPreview(
        targetSeconds
    ) {
        if (!trickplayInfo) {
            previewFrame.style.display =
                "none";

            return;
        }

        const width =
            Number(
                getValue(
                    trickplayInfo,
                    "Width",
                    "width"
                )
            );

        const height =
            Number(
                getValue(
                    trickplayInfo,
                    "Height",
                    "height"
                )
            );

        const tileWidth =
            Number(
                getValue(
                    trickplayInfo,
                    "TileWidth",
                    "tileWidth"
                )
            );

        const tileHeight =
            Number(
                getValue(
                    trickplayInfo,
                    "TileHeight",
                    "tileHeight"
                )
            );

        const interval =
            Number(
                getValue(
                    trickplayInfo,
                    "Interval",
                    "interval"
                )
            );

        if (
            !width ||
            !height ||
            !tileWidth ||
            !tileHeight ||
            !interval
        ) {
            previewFrame.style.display =
                "none";

            return;
        }

        const targetMs =
            targetSeconds * 1000;

        const currentThumbnail =
            Math.floor(
                targetMs /
                interval
            );

        const imagesPerSheet =
            tileWidth *
            tileHeight;

        const tileIndex =
            Math.floor(
                currentThumbnail /
                imagesPerSheet
            );

        const tileOffset =
            currentThumbnail %
            imagesPerSheet;

        const tileX =
            tileOffset %
            tileWidth;

        const tileY =
            Math.floor(
                tileOffset /
                tileWidth
            );

        const url =
            getTrickplayUrl(
                width,
                tileIndex
            );

        if (!url) {
            previewFrame.style.display =
                "none";

            return;
        }

        const scale =
            Math.min(
                PREVIEW_MAX_WIDTH /
                    width,

                PREVIEW_MAX_HEIGHT /
                    height,

                1
            );

        const displayWidth =
            Math.round(
                width * scale
            );

        const displayHeight =
            Math.round(
                height * scale
            );

        previewFrame.style.width =
            displayWidth + "px";

        previewFrame.style.height =
            displayHeight + "px";

        previewImage.style.width =
            displayWidth + "px";

        previewImage.style.height =
            displayHeight + "px";

        if (
            url !== lastTileUrl
        ) {
            previewImage.style
                .backgroundImage =
                `url("${url}")`;

            lastTileUrl = url;
        }

        const sheetWidth =
            width *
            tileWidth *
            scale;

        const sheetHeight =
            height *
            tileHeight *
            scale;

        previewImage.style
            .backgroundSize =
            `${sheetWidth}px ${sheetHeight}px`;

        const offsetX =
            -(
                tileX *
                width *
                scale
            );

        const offsetY =
            -(
                tileY *
                height *
                scale
            );

        previewImage.style
            .backgroundPosition =
            `${offsetX}px ${offsetY}px`;

        previewFrame.style.display =
            "block";
    }

    // ============================================================
    // SHOW OVERLAY
    // ============================================================

    function showOverlay(video) {
        const target =
            getTargetTime(video);

        if (seekSeconds > 0) {
            seekLabel.textContent =
                `▶ +${seekSeconds}s`;

        } else if (
            seekSeconds < 0
        ) {
            seekLabel.textContent =
                `◀ ${seekSeconds}s`;

        } else {
            seekLabel.textContent =
                "0s";
        }

        timeLabel.textContent =
            `${formatTime(startTime)} → ${formatTime(target)}`;

        showPreview(target);

        overlay.style.opacity =
            "1";
    }

    function hideOverlay() {
        overlay.style.opacity =
            "0";

        setTimeout(
            () => {
                previewFrame.style.display =
                    "none";
            },
            100
        );
    }

    // ============================================================
    // RESET
    // ============================================================

    function resetGesture() {
        active = false;
        horizontalGesture = false;

        activeVideo = null;

        seekSeconds = 0;
    }

    // ============================================================
    // TOUCH START
    // ============================================================

    document.addEventListener(
        "touchstart",
        event => {
            if (
                event.touches.length !== 1
            ) {
                return;
            }

            /*
             * CRITICAL:
             *
             * If the user touches the progress
             * slider, pin, button, volume slider,
             * etc., SwipeSeek does nothing.
             *
             * Jellyfin receives the gesture.
             */
            if (
                isPlayerControl(
                    event.target
                )
            ) {
                resetGesture();
                return;
            }

            const video =
                getVideo();

            if (!video) {
                return;
            }

            const touch =
                event.touches[0];

            /*
             * SwipeSeek works only when the
             * gesture STARTS over the video.
             *
             * Works in:
             *
             * - embedded player
             * - fullscreen player
             */
            if (
                !pointIsInsideVideo(
                    video,
                    touch.clientX,
                    touch.clientY
                )
            ) {
                return;
            }

            active = true;

            horizontalGesture =
                false;

            activeVideo =
                video;

            startX =
                touch.clientX;

            startY =
                touch.clientY;

            startTime =
                video.currentTime;

            seekSeconds = 0;

            const currentItemId =
                getItemIdFromVideo(
                    video
                );

            if (
                !trickplayInfo ||
                trickplayItemId !==
                    currentItemId
            ) {
                loadTrickplay(
                    video
                );
            }
        },
        {
            capture: true,
            passive: true
        }
    );

    // ============================================================
    // TOUCH MOVE
    // ============================================================

    document.addEventListener(
        "touchmove",
        event => {
            if (!active) {
                return;
            }

            if (
                event.touches.length !== 1
            ) {
                return;
            }

            const video =
                activeVideo;

            if (!video) {
                return;
            }

            const touch =
                event.touches[0];

            const deltaX =
                touch.clientX -
                startX;

            const deltaY =
                touch.clientY -
                startY;

            /*
             * Wait until movement is large
             * enough to classify the gesture.
             */
            if (
                !horizontalGesture &&
                Math.abs(deltaX) <
                    MIN_DRAG_PX &&
                Math.abs(deltaY) <
                    MIN_DRAG_PX
            ) {
                return;
            }

            /*
             * Vertical gesture:
             *
             * cancel SwipeSeek completely.
             */
            if (
                !horizontalGesture &&
                Math.abs(deltaY) >
                    Math.abs(deltaX)
            ) {
                resetGesture();

                return;
            }

            horizontalGesture =
                true;

            /*
             * Once confirmed as horizontal,
             * take control of the gesture.
             */
            event.preventDefault();

            seekSeconds =
                Math.round(
                    deltaX /
                    PX_PER_SECOND
                );

            seekSeconds =
                Math.max(
                    -MAX_SEEK_SECONDS,

                    Math.min(
                        MAX_SEEK_SECONDS,
                        seekSeconds
                    )
                );

            showOverlay(
                video
            );
        },
        {
            capture: true,
            passive: false
        }
    );

    // ============================================================
    // TOUCH END
    // ============================================================

    document.addEventListener(
        "touchend",
        () => {
            if (!active) {
                activeVideo = null;

                return;
            }

            const video =
                activeVideo;

            if (
                horizontalGesture &&
                video &&
                Math.abs(
                    seekSeconds
                ) >= 1
            ) {
                const target =
                    getTargetTime(
                        video
                    );

                video.currentTime =
                    target;

                console.log(
                    "[Jellyfin SwipeSeek v6] " +
                    `${seekSeconds}s → ` +
                    `${formatTime(target)}`
                );
            }

            if (
                horizontalGesture
            ) {
                setTimeout(
                    hideOverlay,
                    350
                );
            }

            resetGesture();
        },
        {
            capture: true,
            passive: true
        }
    );

    // ============================================================
    // TOUCH CANCEL
    // ============================================================

    document.addEventListener(
        "touchcancel",
        () => {
            resetGesture();
            hideOverlay();
        },
        true
    );

    console.log(
        "[Jellyfin SwipeSeek v6] Ready"
    );
})();