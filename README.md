# exogui

**Important: This application requires eXo projects to be pre-patched with the Linux patch. For download and installation instructions, please visit the [Retro-Exo Linux Guide](https://www.retro-exo.com/linux.html) and the [Linux Patch Wiki](https://wiki.retro-exo.com/index.php/Linux_Patch).**

The launcher for Retro eXo Projects.

> 🍎 **macOS users:** exogui binaries are **not signed with an Apple Developer ID and are not notarized.** macOS will block downloaded builds ("exogui is damaged and can't be opened") until you clear the quarantine attribute:
>
> ```bash
> xattr -cr /Applications/exogui.app && open /Applications/exogui.app
> ```
>
> This one-time step is unavoidable without a paid Apple Developer account. See [Troubleshooting](docs/troubleshooting.md#exogui-is-damaged-and-cant-be-opened--app-wont-launch-after-download) for details.

## Links

-   [eXo Projects](https://www.retro-exo.com) - Official eXo projects website
-   [Retro-Exo Linux Guide](https://www.retro-exo.com/linux.html) - Linux setup guide
-   [exogui discord](https://discord.gg/yMcZnyUn) - exogui-specific support

## About

exogui is an Electron-based desktop application for browsing, managing, and launching games from the [eXo projects](https://www.retro-exo.com). It is based on [BlueMaxima's Flashpoint Launcher](https://bluemaxima.org/flashpoint/) and reads LaunchBox-format XML configuration files.

### Supported eXo Projects

Currently supported:

-   **eXoDOS**
-   **eXoDREAMM**
-   **eXoDemoscene**

More eXo projects coming in the future!

### Features

-   Browse and search through the entire eXo game collections
-   Launch DOS and Windows games with platform-specific configurations
-   Manage playlists and favorites
-   Cross-platform support (Windows, Linux, macOS)
-   Integration with game metadata, screenshots, videos, and interactive 3D box viewer
-   Online auto-updates with stable and beta channels (Linux AppImage)

### macOS Builds

Two macOS builds are produced automatically by the CI workflow:

-   **Universal build** — for macOS 12 (Monterey) and later, supports both Intel and Apple Silicon
-   **Legacy build** — for macOS 11 (Big Sur), built with an older Electron version to maintain compatibility

> ⚠️ **Security notice:** The legacy build uses an older version of Electron (v37) to support macOS 11. Older Electron versions may contain unpatched security vulnerabilities. Use the legacy build only if you cannot upgrade to macOS 12 or later, and avoid using it to browse untrusted content.

If you encounter any issues with exogui, seek help on the [exogui discord](https://discord.gg/yMcZnyUn) server. For general Retro eXo Projects support and Linux setup, visit the [Retro eXo Projects Discord](https://discord.gg/yMcZnyUn) server.

## Installation

> **Note:** The Linux patch and macOS patch distributed by the Retro eXo Projects already include exogui — no manual installation is needed if you installed via the patch. This section is for manually updating exogui or setting it up without the patch.

exogui must be placed inside an `exogui` subfolder directly within the root of your eXo project. This is where it looks for game data by default (`exodosPath: "../"`).

### Directory layout

```
eXoDOS/               ← eXo project root (eXoDOS, eXoDREAMM, etc.)
├── exogui/           ← create this folder and place exogui here
│   └── <exogui files>
├── eXo/
├── Data/
└── ...
```

### Examples by platform

**Linux — AppImage**

Download `exogui.AppImage`, place it in the `exogui` subfolder, and make it executable:

```
eXoDOS/
└── exogui/
    └── exogui.AppImage
```

```bash
chmod +x exogui.AppImage
./exogui.AppImage
```

**Linux — tar.gz**

Extract the archive into the `exogui` subfolder:

```
eXoDOS/
└── exogui/
    ├── exogui
    └── (other extracted files)
```

```bash
tar -xzf exogui.tar.gz -C eXoDOS/exogui/
./eXoDOS/exogui/exogui
```

**macOS — .app bundle**

Extract the zip and move `exogui.app` into the `exogui` subfolder:

```
eXoDOS/
└── exogui/
    └── exogui.app
```

Double-click `exogui.app` to launch, or from Terminal:

```bash
open eXoDOS/exogui/exogui.app
```

**Windows — zip**

Extract the zip into the `exogui` subfolder:

```
eXoDOS\
└── exogui\
    ├── exogui.exe
    └── (other extracted files)
```

Run `exogui.exe`. The Windows NSIS installer (`.exe` setup file) handles this placement automatically.

### Overriding the eXo project path

If you cannot follow the above layout, open `exogui/config.json` and set `exodosPath` to the absolute path of your eXo project root:

```json
{
    "exodosPath": "/path/to/eXoDOS"
}
```

## Development Setup

This project is currently intended for developers. To set up your development environment:

1. **Clone the repository** with submodules:

    ```bash
    git clone --recurse-submodules https://github.com/exogui/exogui launcher
    cd launcher
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Run in development mode** (recommended approach):
    - Terminal 1: Start the watch process to rebuild on changes
        ```bash
        npm run watch
        ```
    - Terminal 2: Start the application
        ```bash
        npm run start
        ```

Alternatively, you can build once and run:

```bash
npm run build
npm run start
```

## Package Scripts

### Common Commands

-   `npm run build` - Build the launcher (main, renderer, and static files to `./build/`)
-   `npm run watch` - Build and incrementally rebuild on source file changes
-   `npm run start` - Run the latest build of the launcher
-   `npm test` - Run Jest tests
-   `npm run lint` - Run ESLint

### Packaging

-   `npm run pack` - Package the latest build (outputs to `./dist/`)
-   `npm run release` - Build and package in one step

#### Platform-Specific Packaging

-   `npm run pack:linux` - Package for Linux (x64)
-   `npm run pack:win32` - Package for Windows (ia32)
-   `npm run pack:mac-universal` - Package for macOS (Universal — Intel + Apple Silicon)
-   `npm run pack:all` - Package for all platforms

Use `release:*` variants (e.g., `npm run release:linux`) to build and package in production mode.

**Note:** You can also set environment variables `PACK_PLATFORM` and `PACK_ARCH` to customize packaging.

## Configuration Files

exogui uses several JSON configuration files to control its behavior:

-   **[config.json](docs/config.md)** - Application configuration (paths, ports, native platforms)
-   **[preferences.json](docs/preferences.md)** - User preferences (UI settings, theme, window size)
-   **[mappings.json](docs/mappings.md)** - File extension to application mappings (for opening manuals, videos, etc.)
-   **[platform_options.json](docs/platform_options.md)** - Platform-specific options (file watching)

## Documentation

-   **[docs/architecture.md](docs/architecture.md)** - Detailed architecture overview and socket communication
-   **[docs/online-updates.md](docs/online-updates.md)** - Online updates for Linux AppImage
-   **[docs/troubleshooting.md](docs/troubleshooting.md)** - Troubleshooting guide for common issues
