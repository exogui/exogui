# Troubleshooting Guide

This document provides solutions to common issues you may encounter when developing or running exogui.

## Build and Development Issues

### "Not allowed to load local resource" Error

**Problem:** This error appears in the Electron application console.

**Example:**

```
Not allowed to load local resource: file:///<ProjectPath>/build/renderer/index.html
```

**Solution:**
This error typically occurs because the built files don't exist. Run the build process:

```bash
npm run build
```

This will generate all necessary files in the `./build/` directory.

---

### Build Issues

**Problem:** Build fails or dependencies are missing.

**Solutions:**

1. **Ensure dependencies are installed:**

    ```bash
    npm install
    ```

2. **If using submodules, clone correctly:**

    ```bash
    git clone --recurse-submodules https://github.com/margorski/exodos-launcher launcher
    ```

    If you already cloned without submodules:

    ```bash
    git submodule update --init --recursive
    ```

3. **Check Node.js version compatibility:**

    - See `package.json` for required Node.js version
    - Update Node.js if necessary

4. **Clear build cache:**
    ```bash
    rm -rf build/
    rm -rf node_modules/
    npm install
    npm run build
    ```

---

## Application Runtime Issues

### Application Won't Start

**Problem:** exogui fails to launch or crashes immediately.

**Solutions:**

1. **Check if build files exist:**

    ```bash
    ls build/
    ```

    If empty or missing, run `npm run build`

2. **Check for port conflicts:**

    - Default backend port range: 12001-12100
    - Default file server port range: 12101-12200
    - See [config.md](config.md) for changing port ranges

3. **Check logs:**
    - Look for error messages in the terminal
    - Check the developer console in the Electron app (Ctrl+Shift+I or Cmd+Option+I)

---

### Games Not Loading

**Problem:** No games appear in the launcher.

**Solutions:**

1. **Verify eXoDOS path in config.json:**

    - Check that `exodosPath` points to your eXoDOS installation
    - Example: `"/home/user/Games/eXoDOS/"`

2. **Check platform data:**

    - Verify `platformFolderPath` contains `Platforms.xml`
    - Verify platform XML files exist (e.g., `MS-DOS.xml`, `Win3x.xml`)

3. **Check file permissions:**

    - Ensure exogui has read access to the eXoDOS directory
    - On Linux/macOS: `chmod -R +r /path/to/eXoDOS`

4. **Restart exogui:**
    - Close and restart the application after config changes

For more details on configuration, see [config.md](config.md).

---

### Images/Screenshots Not Displaying

**Problem:** Game images and screenshots don't load.

**Solutions:**

1. **Check image folder path:**

    - Verify `imageFolderPath` in `config.json`
    - Default: `"Images"` (relative to `exodosPath`)

2. **Check file server:**

    - Ensure no port conflicts with `imagesPortMin`/`imagesPortMax`
    - Check browser console for HTTP errors (F12)

3. **Verify image files exist:**
    - Check that image files are in the correct directory
    - Verify file permissions allow reading

---

## macOS-Specific Issues

**Note:** macOS support is currently under development and may not work correctly.

**Known Issues:**

-   Application may not launch properly
-   Some features may be incomplete or non-functional

**Status:**
Check the [exogui discord](https://discord.gg/srHzx9HS) for the latest macOS development updates.

---

## Port Conflicts

**Problem:** Application fails to start with "Port already in use" error.

**Solutions:**

1. **Check what's using the ports:**

    ```bash
    # Linux/macOS
    lsof -i :12001-12200

    # Windows
    netstat -ano | findstr "12001"
    ```

2. **Change port ranges in config.json:**

    ```json
    {
        "backPortMin": 15001,
        "backPortMax": 15100,
        "imagesPortMin": 15101,
        "imagesPortMax": 15200
    }
    ```

3. **Restart exogui** after changing configuration

See [config.md](config.md#network-configuration) for more details.

---

## Getting Help

If you continue to experience issues:

1. **Check existing documentation:**

    - [README.md](../README.md) - Project overview
    - [architecture.md](architecture.md) - Technical architecture
    - [config.md](config.md) - Configuration reference

2. **Search or ask on Discord:**

    - [exogui discord](https://discord.gg/srHzx9HS) - exogui-specific issues
    - [eXoDOS Discord](https://www.retro-exo.com/community.html) - General eXoDOS support

3. **Report bugs:**
    - Check [GitHub Issues](https://github.com/exogui/exogui-launcher/issues)
    - Create a new issue with:
        - Operating system and version
        - Node.js version
        - Steps to reproduce
        - Error messages or logs
