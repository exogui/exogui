# Command Mappings Documentation

This document describes the `mappings.json` file used by exogui to map file extensions to specific commands for opening additional applications (manuals, videos, documents, etc.).

## Manual Editing

⚠️ **Edit only if using custom applications.**

This file is **preconfigured for use with applications installed by the eXoDOS Linux patch**. The default configuration works out-of-the-box with Flatpak applications from the Retro-Exo collection.

**Only modify this file if:**
- You want to use different applications than the defaults
- You know what you're doing and understand command-line execution

Changes take effect immediately (no restart required for most file types).

## Location

The `mappings.json` file is located in the root directory of the exogui installation.

## Purpose

Command mappings define which application should be used to open files based on their extension. For example, PDF files can be opened with a PDF viewer, videos with a media player, etc. This is particularly useful on Linux where different applications need to be specified explicitly.

## File Structure

```json
{
    "defaultMapping": {
        "extensions": [],
        "command": "xdg-open",
        "includeFilename": true,
        "includeArgs": true
    },
    "commandsMapping": [
        {
            "extensions": ["pdf", "png"],
            "command": "flatpak run com.retro_exo.okular",
            "includeFilename": true,
            "includeArgs": false
        }
    ]
}
```

## Configuration Fields

### `defaultMapping`

-   **Type:** Object (`ICommandMapping`)
-   **Required:** Yes
-   **Description:** The fallback command used when no specific mapping matches the file extension
-   **Default:** Uses `xdg-open` on Linux to open with the system default application

### `commandsMapping`

-   **Type:** Array of Objects (`ICommandMapping[]`)
-   **Required:** Yes
-   **Description:** Array of command mappings for specific file extensions
-   **Default:** Contains mappings for common file types (videos, images, documents, etc.)

## Command Mapping Object

Each command mapping object has the following structure:

### `extensions`

-   **Type:** `string[]`
-   **Required:** Yes
-   **Description:** Array of file extensions (without dot) that this mapping applies to
-   **Example:** `["pdf", "png", "jpg"]`
-   **Notes:** Extensions are matched case-insensitively

### `command`

-   **Type:** `string`
-   **Required:** Yes
-   **Description:** The shell command to execute to open the file
-   **Example:** `"flatpak run com.retro_exo.okular"`
-   **Notes:**
    -   Can be a full path or command name
    -   Can include command-line arguments
    -   Empty string `""` for `.command` files means execute the file directly

### `includeFilename`

-   **Type:** `boolean`
-   **Required:** Yes
-   **Description:** Whether to include the filename in the command
-   **Values:**
    -   `true` - Filename will be appended to the command
    -   `false` - Filename will not be included
-   **Default:** `true`

### `includeArgs`

-   **Type:** `boolean`
-   **Required:** Yes
-   **Description:** Whether to include additional arguments from the game/application definition
-   **Values:**
    -   `true` - Arguments will be appended after the filename
    -   `false` - Arguments will not be included
-   **Default:** `true`

## Default Configuration

The default `mappings.json` includes mappings for:

### Media Files

```json
{
    "extensions": ["avi", "flac", "mp3", "mp4", "wav"],
    "command": "flatpak run com.retro_exo.mpv --force-window",
    "includeFilename": true,
    "includeArgs": false
}
```

### Document Viewers

```json
{
    "extensions": ["bmp", "gif", "jfif", "pdf", "png"],
    "command": "flatpak run com.retro_exo.okular",
    "includeFilename": true,
    "includeArgs": false
}
```

### Comic Book Reader

```json
{
    "extensions": ["cbr", "jpeg", "jpg"],
    "command": "flatpak run com.retro_exo.mcomix",
    "includeFilename": true,
    "includeArgs": false
}
```

### Text Documents

```json
{
    "extensions": ["doc", "docx", "rtf", "txt"],
    "command": "flatpak run com.retro_exo.abiword",
    "includeFilename": true,
    "includeArgs": false
}
```

### Windows Executables

```json
{
    "extensions": ["exe"],
    "command": "flatpak run com.retro_exo.wine",
    "includeFilename": true,
    "includeArgs": true
}
```

### Shell Scripts

```json
{
    "extensions": ["command"],
    "command": "",
    "includeFilename": true,
    "includeArgs": true
}
```

### Web Browsers

```json
{
    "extensions": ["htm", "html"],
    "command": "flatpak run com.retro_exo.falkon -i",
    "includeFilename": true,
    "includeArgs": false
}
```

### Spreadsheets

```json
{
    "extensions": ["xls", "xlsx", "ods"],
    "command": "flatpak run com.retro_exo.gnumeric",
    "includeFilename": true,
    "includeArgs": false
}
```

## Platform-Specific Behavior

### Windows

On Windows, the command mapping system uses the `start` command to open files with their associated applications. The mappings are generally less critical on Windows since file associations are handled by the OS.

### Linux

On Linux, command mappings are essential because there's no universal file association system. The default configuration uses Flatpak applications from the Retro-Exo collection.

**Default fallback:** `xdg-open` (system default application)

### macOS

On macOS (when supported), the `open` command can be used as the default mapping.
