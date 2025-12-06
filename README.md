# exogui

The launcher for the eXoDOS project.

## Links

-   [eXo Projects](https://www.retro-exo.com) - Official eXo projects website
-   [Retro-Exo Linux Guide](https://www.retro-exo.com/linux.html) - Linux setup guide
-   [exogui discord](https://discord.gg/srHzx9HS) - exogui-specific support

## About

exogui is an Electron-based desktop application for browsing, managing, and launching games from the [eXo projects](https://www.retro-exo.com). It is based on [BlueMaxima's Flashpoint Launcher](https://bluemaxima.org/flashpoint/) and reads LaunchBox-format XML configuration files.

### Supported eXo Projects

Currently supported:

-   **eXoDOS** - DOS games collection
-   **eXoDREAMM** - Dreamcast games collection
-   **eXoDemoscene** - Demoscene collection

More eXo projects coming in the future!

### Features

-   Browse and search through the entire eXo game collections
-   Launch DOS and Windows games with platform-specific configurations
-   Manage playlists and favorites
-   Cross-platform support (Windows, Linux)
-   macOS support is currently under development
-   Integration with game metadata, screenshots, and videos

If you encounter any issues with exogui, seek help on the [exogui discord](https://discord.gg/srHzx9HS) server. For general eXoDOS support and Linux setup, visit the [eXoDOS Discord](https://www.retro-exo.com/community.html) server.

## Development Setup

This project is currently intended for developers. To set up your development environment:

1. **Clone the repository** with submodules:

    ```bash
    git clone --recurse-submodules https://github.com/margorski/exodos-launcher launcher
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
-   `npm run pack:darwin` - Package for macOS (Intel) - _under development_
-   `npm run pack:m1` - Package for macOS (Apple Silicon) - _under development_
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
-   **[docs/troubleshooting.md](docs/troubleshooting.md)** - Troubleshooting guide for common issues
