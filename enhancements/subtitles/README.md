# Jellyfin Subtitle Enhancements

`jellyfin-subtitle.js` is the home for subtitle-related Jellyfin Web
improvements. Its first feature remembers the last subtitle synchronization
offset and restores it for later videos and browser sessions.

## Behavior

- Stores offsets separately for each Jellyfin server and user.
- Captures slider changes and values entered in the subtitle-offset text field.
- Restores the saved value when a new player or subtitle-sync control is created.
- Reapplies the value after Jellyfin resets subtitle timing during playback.
- Supports offsets from `-90` to `+90` seconds in `0.1` second increments.

The script works with subtitle formats for which Jellyfin Web exposes its
subtitle-offset control. Burned-in subtitles cannot be shifted by the browser.

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
4. Start another video or reload Jellyfin Web.
5. Open the subtitle-offset control and verify that `-1.5s` is restored.

To reset the preference, select `0s` in the subtitle-offset control.
