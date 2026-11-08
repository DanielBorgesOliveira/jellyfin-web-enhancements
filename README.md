# Jellyfin Web Enhancements

Unofficial, modular enhancements for Jellyfin Web. Each script is
self-contained and can be installed independently.

## Repository layout

| Category | Script | Purpose |
| --- | --- | --- |
| Subtitles | [`jellyfin-subtitle.js`](enhancements/subtitles/jellyfin-subtitle.js) | Subtitle improvements, starting with persistent synchronization offset |
| VR | [`jellyfin-video360-viewer.js`](enhancements/vr/jellyfin-video360-viewer.js) | 360° video playback |
| VR | [`jellyfin-photo360-viewer.js`](enhancements/vr/jellyfin-photo360-viewer.js) | 360° photo viewing |
| Playback | [`jellyfin-swipe-seek.js`](enhancements/playback/jellyfin-swipe-seek.js) | Touch/mouse swipe seeking |
| Display | [`jellyfin-auto-rotate.js`](enhancements/display/jellyfin-auto-rotate.js) | Landscape orientation during fullscreen playback |
| Diagnostics | [`jellyfin-debug.js`](enhancements/diagnostics/jellyfin-debug.js) | Confirms that JavaScript injection is working |

See the [subtitle enhancement documentation](enhancements/subtitles/README.md)
for installation and testing instructions for `jellyfin-subtitle.js`.
