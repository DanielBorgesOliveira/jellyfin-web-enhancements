# Jellyfin Subtitle Enhancements

`jellyfin-subtitle.js` is the home for subtitle-related Jellyfin Web
improvements. Its first feature remembers the last subtitle synchronization
offset for each movie and subtitle track and restores it when that track is selected again.

## Behavior

- Stores offsets separately for each movie, media version, subtitle track, Jellyfin server, and user in this browser.
- Tracks in different languages, and multiple tracks in the same language, have separate offsets.
- Selections without a saved offset start at `0s`; old shared and movie-only offsets are ignored.
- When primary and secondary subtitles are enabled together, saves one offset for that pair because Jellyfin applies its offset control to both tracks.
- Captures slider changes and values entered in the subtitle-offset text field.
- Restores the saved value when a new player or subtitle-sync control is created.
- Reapplies the value after Jellyfin resets subtitle timing during playback.
- Supports offsets from `-90` to `+90` seconds in `0.1` second increments.

The script works with subtitle formats for which Jellyfin Web exposes its
subtitle-offset control. Burned-in subtitles cannot be shifted by the browser.
The selection is identified through the playback manager when exposed by the loader.
Otherwise the script queries Jellyfin's sessions for this device and signed-in user
every 1.5 seconds while a video and sync control exist. Track changes may take a few
seconds to appear in Jellyfin's reported session. If session access is unavailable,
the selection is ambiguous, or subtitles are off, it leaves timing unchanged and
does not save an offset. Burned-in subtitles remain subject to Jellyfin's controls.

## Installation

Load `jellyfin-subtitle.js` after the Jellyfin Web application has
started. For development, paste the script into the browser developer console
while Jellyfin Web is open, then start a video with an external subtitle track.

For a permanent installation, include the script from the Jellyfin Web host or
use an existing custom-script loader. Reload Jellyfin Web after installation.

## Testing

1. Start a video with an external subtitle track.
2. Open **Subtitles > Subtitle Offset**.
3. Select a non-zero offset, such as `-1.5s`.
4. Switch to another subtitle language, wait for the session update, and verify its offset is `0s`. Set it to `+2s`.
5. Switch back and verify that `-1.5s` is restored. Also test two tracks in the same language if available.
6. Start another movie and verify that its tracks start at `0s`.
7. Reload Jellyfin Web and replay the first movie to verify its separate track offsets.
8. Test a primary/secondary subtitle pair, then return to a single track and verify its saved offset.

To reset a selection's preference, select `0s` in its subtitle-offset control.
