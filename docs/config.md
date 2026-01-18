# Configuration File Documentation

This document describes the `config.json` file used by exogui to configure application-level settings.

## Manual Editing

✅ **This file can be edited manually.**

After making changes to `config.json`, you must **restart exogui** for the changes to take effect.

## Location

The `config.json` and `preferences.json` files are located in different directories depending on the build type:

- **Linux AppImage**: `~/.config/exogui/`
- **Linux tar.gz**: Application directory (where you extracted the archive)
- **Windows**: Application installation directory (e.g., `C:\Program Files\exogui\`)
- **macOS**: `~/Library/Application Support/exogui/`
- **Development mode**: Project root directory

**Note:** Other application resource files (mappings.json, 7zip binaries, lang/, licenses/) are bundled with the application and located separately from user configuration files.

## File Structure

```json
{
    "exodosPath": "/path/to/eXoDOS/",
    "imageFolderPath": "Images",
    "logoFolderPath": "Data/Logos",
    "playlistFolderPath": "Data/Playlists",
    "jsonFolderPath": "Data",
    "platformFolderPath": "Data/Platforms",
    "useCustomTitlebar": false,
    "backPortMin": 12001,
    "backPortMax": 12100,
    "imagesPortMin": 12101,
    "imagesPortMax": 12200,
    "nativePlatforms": [],
    "currentTheme": "fancy.css",
    "showDeveloperTab": false,
    "vlcPort": 39421,
    "enableAutoUpdate": true
}
```

## Configuration Fields

### Path Configuration

#### `exodosPath`

-   **Type:** `string`
-   **Required:** Yes
-   **Description:** Path to the eXo project root folder. Can be relative or absolute.
-   **Example:**
    -   Windows: `"C:/Games/eXoDOS/"`
    -   Linux: `"/home/user/Games/eXoDOS/"`
    -   Relative: `"../eXoDOS/"`
-   **Notes:**
    -   All other folder paths are relative to this path
    -   Use forward slashes (/) even on Windows for consistency
    -   Must end with a trailing slash

#### `imageFolderPath`

-   **Type:** `string`
-   **Required:** Yes
-   **Default:** `"Images"`
-   **Description:** Path to the game images folder, relative to `exodosPath`
-   **Contains:** Game screenshots, box art, and other game images
-   **Full path example:** `{exodosPath}/Images/`

#### `logoFolderPath`

-   **Type:** `string`
-   **Required:** Yes
-   **Default:** `"Data/Logos"`
-   **Description:** Path to the game logos folder, relative to `exodosPath`
-   **Contains:** Platform and game logos
-   **Full path example:** `{exodosPath}/Data/Logos/`

#### `playlistFolderPath`

-   **Type:** `string`
-   **Required:** Yes
-   **Default:** `"Data/Playlists"`
-   **Description:** Path to the playlists folder, relative to `exodosPath`
-   **Contains:** `.json` files defining game playlists/collections
-   **Full path example:** `{exodosPath}/Data/Playlists/`

#### `jsonFolderPath`

-   **Type:** `string`
-   **Required:** Yes
-   **Default:** `"Data"`
-   **Description:** Path to the JSON data folder, relative to `exodosPath`
-   **Contains:** General JSON data files
-   **Full path example:** `{exodosPath}/Data/`

#### `platformFolderPath`

-   **Type:** `string`
-   **Required:** Yes
-   **Default:** `"Data/Platforms"`
-   **Description:** Path to the platforms folder, relative to `exodosPath`
-   **Contains:** LaunchBox XML files (`Platforms.xml`, `MS-DOS.xml`, etc.)
-   **Full path example:** `{exodosPath}/Data/Platforms/`
-   **Notes:** This is the most critical path - game data is loaded from these XML files

### UI Configuration

#### `useCustomTitlebar`

-   **Type:** `boolean`
-   **Required:** Yes
-   **Default:** `false`
-   **Description:** If `true`, uses a custom title bar in the main window instead of the OS default
-   **Notes:**
    -   Custom title bar provides consistent UI across platforms
    -   OS default title bar integrates better with desktop environment
    -   Changing this requires an application restart

### Network Configuration

exogui uses dynamic port allocation within specified ranges. The backend tries ports sequentially until it finds an available one.

#### `backPortMin`

-   **Type:** `number`
-   **Required:** Yes
-   **Default:** `12001`
-   **Description:** Lower limit of the port range for the backend WebSocket server
-   **Valid range:** `1024` - `65535`
-   **Notes:**
    -   Backend WebSocket server handles renderer ↔ backend communication
    -   Must not overlap with `imagesPortMin`-`imagesPortMax`

#### `backPortMax`

-   **Type:** `number`
-   **Required:** Yes
-   **Default:** `12100`
-   **Description:** Upper limit of the port range for the backend WebSocket server
-   **Valid range:** `1024` - `65535`
-   **Notes:**
    -   Must be greater than `backPortMin`
    -   Range of 100 ports should be sufficient for most cases

#### `imagesPortMin`

-   **Type:** `number`
-   **Required:** Yes
-   **Default:** `12101`
-   **Description:** Lower limit of the port range for the file server
-   **Valid range:** `1024` - `65535`
-   **Notes:**
    -   File server serves static assets (images, videos, etc.) via HTTP
    -   Must not overlap with `backPortMin`-`backPortMax`

#### `imagesPortMax`

-   **Type:** `number`
-   **Required:** Yes
-   **Default:** `12200`
-   **Description:** Upper limit of the port range for the file server
-   **Valid range:** `1024` - `65535`
-   **Notes:**
    -   Must be greater than `imagesPortMin`
    -   Range of 100 ports should be sufficient for most cases

### Platform Configuration

#### `nativePlatforms`

-   **Type:** `string[]`
-   **Required:** Yes
-   **Default:** `[]`
-   **Description:** Array of platform names that should use native executables instead of Wine on Linux/macOS
-   **Example:** `["MS-DOS", "ScummVM"]`
-   **Notes:**
    -   On Linux/macOS, platforms in this array will use native executables from `execMappings`
    -   For example, MS-DOS games will use native Linux DOSBox instead of running Windows DOSBox through Wine
    -   Empty array means all platforms will use Wine (or Windows paths on Windows)
    -   Platform names must match exactly with names in `Platforms.xml`
    -   This improves performance and compatibility for platforms with native Linux/macOS support

### Theme Configuration

#### `currentTheme`

-   **Type:** `string`
-   **Required:** No
-   **Default:** `"fancy.css"`
-   **Description:** Filename of the currently active theme CSS file
-   **Example:** `"fancy.css"`, `"ocean.css"`, `"forest.css"`, `"sunset.css"`
-   **Notes:**
    -   Themes are bundled with the application
    -   Theme changes apply immediately without restart

#### `showDeveloperTab`

-   **Type:** `boolean`
-   **Required:** Yes
-   **Default:** `false`
-   **Description:** Whether to show the Developer tab in the header navigation
-   **Notes:**
    -   Developer tab provides access to debugging tools and utilities
    -   Useful for curators and developers working on game metadata
    -   Changing this requires an application restart

### Media Configuration

#### `vlcPort`

-   **Type:** `number`
-   **Required:** Yes
-   **Default:** `39421`
-   **Description:** Port number for VLC media player HTTP interface
-   **Valid range:** `1024` - `65535`
-   **Notes:**
    -   Used to control VLC for game music playback (Windows only)
    -   Must not conflict with other ports used by exogui or system services
    -   Changing this requires an application restart

### Update Settings

#### `enableAutoUpdate`

-   **Type:** `boolean`
-   **Required:** Yes
-   **Default:** `true`
-   **Description:** Enable automatic updates for the application (Linux AppImage only)
-   **Platform Support:**
    -   ✅ **Linux AppImage**: Fully supported
    -   ❌ **Other formats**: No effect (tar.gz, Snap, Flatpak use different update mechanisms)
    -   ❌ **Windows/macOS**: Currently disabled (requires code signing certificates)
-   **Behavior:**
    -   Checks for updates 5 seconds after app startup (non-blocking)
    -   Only works in production builds (not development mode)
    -   Compares version in GitHub releases with current version
    -   Downloads update to temporary location if newer version available
    -   User can choose to install immediately or on next restart
-   **Notes:**
    -   To disable automatic updates, change this value to `false` and restart exogui
    -   See [docs/auto-updates.md](auto-updates.md) for complete details

**Note:** All configuration changes require an application restart to take effect.
