# Platform Options Documentation

This document describes the `platform_options.json` file used by exogui to configure platform-specific behaviors.

## Manual Editing

🔒 **Developers only - do not edit unless adding new platforms.**

This file is **prefilled with data for all currently working eXo projects**. It is properly configured out-of-the-box.

**Only modify this file if you are:**
- A developer adding support for a new platform to exogui
- Working under developer guidance to troubleshoot file watching issues

Regular users should not need to edit this file. Changes require an application restart.

## Location

The `platform_options.json` file is located in the root directory of the exogui installation.

## Purpose

Platform options define special behaviors for specific game platforms. Currently, it controls whether exogui should watch for file system changes for games on a particular platform.

## File Structure

```json
[
    {
        "name": "MS-DOS",
        "watchable": true
    },
    {
        "name": "Windows 3x",
        "watchable": true
    }
]
```

The file contains an array of platform option objects.

## Platform Option Object

Each platform option object has the following structure:

### `name`

-   **Type:** `string`
-   **Required:** Yes
-   **Description:** The exact name of the platform as it appears in `Platforms.xml`
-   **Example:** `"MS-DOS"`, `"ScummVM"`, `"Windows 3x"`
-   **Notes:**
    -   Must match the platform name exactly (case-sensitive)
    -   Platform name should exist in the eXo project's `Platforms.xml` file

### `watchable`

-   **Type:** `boolean`
-   **Required:** Yes
-   **Description:** Whether exogui should watch for file system changes for this platform
-   **Values:**
    -   `true` - Enable file watching for this platform
    -   `false` - Disable file watching for this platform
-   **Default:** `false` (if platform not in list)

## What Does "Watchable" Mean?

When a platform is marked as `watchable: true`, exogui will:

1. **Monitor game installation directories** for changes
2. **Automatically update game installation status** when files are added or removed
3. **Watch for video files** in the platform's video directory
4. **Watch for manual files** in the platform's manuals directory

This feature is useful for platforms where games can be installed/uninstalled independently, allowing the launcher to automatically reflect the current state.

## Default Configuration

The default `platform_options.json` includes the following platforms:

```json
[
    {
        "name": "MS-DOS",
        "watchable": true
    },
    {
        "name": "Apple IIGS",
        "watchable": true
    },
    {
        "name": "DREAMM",
        "watchable": true
    },
    {
        "name": "eXoDemoScene",
        "watchable": true
    },
    {
        "name": "ScummVM",
        "watchable": true
    },
    {
        "name": "ScummVM SVN",
        "watchable": true
    },
    {
        "name": "Windows 3x",
        "watchable": true
    }
]
```
