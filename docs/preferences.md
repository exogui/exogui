# User Preferences Documentation

This document describes the `preferences.json` file used by exogui to store user-specific settings and UI state.

## Manual Editing

❌ **Do not edit manually - managed automatically by exogui.**

This file is **automatically updated by exogui** as you use the application. All settings in this file can be changed through the exogui user interface.

**Manual editing is not recommended because:**
- Changes are automatically saved by the application
- Incorrect values may cause UI issues or crashes
- Your changes may be overwritten when exogui saves preferences
- All settings are accessible through the UI (Settings menu, sliders, toggles, etc.)

If you must edit manually (e.g., to reset corrupted settings), ensure exogui is closed first and validate JSON syntax carefully.

## Location

The `preferences.json` file is located in the root directory of the exogui installation.

## Purpose

User preferences store all non-configuration settings that control the appearance and behavior of the exogui interface. Unlike `config.json` (which contains system-level settings), preferences are user-specific UI settings that are frequently modified through the application.

## File Structure

```json
{
    "browsePageGameScale": 0.087,
    "browsePageLayout": 1,
    "browsePageShowLeftSidebar": true,
    "browsePageShowRightSidebar": true,
    "browsePageLeftSidebarWidth": 320,
    "browsePageRightSidebarWidth": 320,
    "lastSelectedLibrary": "",
    "gamesOrderBy": "title",
    "gamesOrder": "ascending",
    "mainWindow": {
        "maximized": false
    },
    "showLogSource": {},
    "gameMusicPlay": true,
    "gameMusicVolume": 0.5
}
```

## Preference Fields

### Browse Page Settings

#### `browsePageGameScale`

-   **Type:** `number`
-   **Default:** `0.087`
-   **Description:** Scale/zoom level of game thumbnails on the browse page
-   **Range:** Typically between `0.05` (small) and `0.2` (large)
-   **UI Control:** Zoom slider in browse page

#### `browsePageLayout`

-   **Type:** `number`
-   **Default:** `1`
-   **Description:** Layout mode for displaying games
-   **Values:**
    -   `0` - Grid layout
    -   `1` - List layout
    -   `2` - Compact layout
-   **UI Control:** Layout toggle buttons

#### `browsePageShowLeftSidebar`

-   **Type:** `boolean`
-   **Default:** `true`
-   **Description:** Whether the left sidebar (library list) is visible
-   **UI Control:** Sidebar toggle button

#### `browsePageShowRightSidebar`

-   **Type:** `boolean`
-   **Default:** `true`
-   **Description:** Whether the right sidebar (game details) is visible
-   **UI Control:** Sidebar toggle button

#### `browsePageLeftSidebarWidth`

-   **Type:** `number`
-   **Default:** `320`
-   **Description:** Width in pixels of the left sidebar
-   **Range:** Typically `200` - `600`
-   **UI Control:** Sidebar resize handle

#### `browsePageRightSidebarWidth`

-   **Type:** `number`
-   **Default:** `320`
-   **Description:** Width in pixels of the right sidebar
-   **Range:** Typically `200` - `600`
-   **UI Control:** Sidebar resize handle

### Library Settings

#### `lastSelectedLibrary`

-   **Type:** `string`
-   **Default:** `""` (empty string uses default)
-   **Description:** Route/ID of the last selected game library/platform
-   **Purpose:** Restores the selected library when reopening exogui
-   **Example:** `"MS-DOS"`, `"ScummVM"`

### Game Ordering

#### `gamesOrderBy`

-   **Type:** `string`
-   **Default:** `"title"`
-   **Description:** Property to sort games by
-   **Values:**
    -   `"title"` - Game title
    -   `"developer"` - Developer name
    -   `"publisher"` - Publisher name
    -   `"releaseDate"` - Release date
    -   `"platform"` - Platform name
-   **UI Control:** Sort dropdown in browse page

#### `gamesOrder`

-   **Type:** `string`
-   **Default:** `"ascending"`
-   **Description:** Sort direction
-   **Values:**
    -   `"ascending"` - A to Z, earliest to latest
    -   `"descending"` - Z to A, latest to earliest
-   **UI Control:** Sort order toggle button

### Window Settings

#### `mainWindow`

-   **Type:** `object`
-   **Description:** Position and size of the main application window
-   **Properties:**
    -   `x` (number, optional): X position in pixels
    -   `y` (number, optional): Y position in pixels
    -   `width` (number, optional): Window width in pixels
    -   `height` (number, optional): Window height in pixels
    -   `maximized` (boolean): Whether window is maximized

**Example:**

```json
{
    "x": 100,
    "y": 100,
    "width": 1280,
    "height": 720,
    "maximized": false
}
```

### Logging Settings

#### `showLogSource`

-   **Type:** `object`
-   **Default:** `{}`
-   **Description:** Object mapping log sources to visibility state
-   **Format:** `{ "sourceName": true/false }`
-   **Purpose:** Filter which log sources are displayed in the log viewer

**Example:**

```json
{
    "Back": true,
    "Game Launcher": true,
    "Renderer": false
}
```

### Music Settings

#### `gameMusicPlay`

-   **Type:** `boolean`
-   **Default:** `true`
-   **Description:** Whether to play game background music/soundtracks
-   **UI Control:** Music toggle button

#### `gameMusicVolume`

-   **Type:** `number`
-   **Default:** `0.5`
-   **Description:** Volume level for game music
-   **Range:** `0.0` (muted) to `1.0` (full volume)
-   **UI Control:** Volume slider

## Runtime Modifications

Most preferences are automatically saved when changed through the exogui interface:

-   Adjusting sliders (game scale, volume)
-   Toggling sidebars
-   Resizing panels
-   Window position/size
-   Changing sort order and filters
