# Playback enhancements

## Picture-in-Picture

Load `jellyfin-picture-in-picture.js` through your Jellyfin custom JavaScript
loader, then reload Jellyfin Web. Use it as a regular script, not a module.

During local video playback, the script adds a Picture-in-Picture button beside
Fullscreen when Jellyfin's own Picture-in-Picture button is hidden or absent.
When the native button is available, the fallback stays hidden to avoid duplicates.
Click the fallback again to return to the player, or close the floating window.
It stays disabled until the video is ready, and hidden when the browser API or
permissions policy does not allow Picture-in-Picture. Remote/cast playback is
not supported by this local-video enhancement.

This uses the browser's standard video Picture-in-Picture API. Keep the Jellyfin
tab open. Custom subtitle overlays, including some external subtitles, may not
appear in the floating window. Browser-provided window controls vary. Browsers
that only offer their own Picture-in-Picture UI or vendor-specific APIs will
not get this fallback button.

### Verification

1. Play a movie and find Picture-in-Picture beside Fullscreen. Confirm only one
   Picture-in-Picture button appears when Jellyfin's native button is visible.
2. Click to detach; verify playback continues with sound and the current position.
3. Click again to return. Repeat, closing the floating window with its own close
   button, and confirm the fallback's label resets to Picture-in-Picture.
4. Try entering from fullscreen, pausing/resuming, and starting a different movie.
5. Test subtitles in the floating window, including your external subtitle format.
6. Confirm unsupported browsers do not show the fallback, and rejected requests
   display a message while keeping playback usable.

The other playback script, `jellyfin-swipe-seek.js`, adds touch/mouse swipe seeking
and can be installed independently.
