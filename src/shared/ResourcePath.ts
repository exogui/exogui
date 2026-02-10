import * as path from "path";

interface ElectronApp {
    getPath(name: string): string;
    getAppPath(): string;
}

/**
 * Get the base path for application resources (extraFiles from electron-builder).
 * Resources include: mappings files, 7zip binaries, lang/, licenses/, platform_options.json
 *
 * These files are copied via extraFiles in gulpfile.js and placed in the resources directory.
 * The location varies by platform and build type:
 *
 * - AppImage: /tmp/.mount_xxx/resources/ (via process.resourcesPath)
 * - macOS .app: Outside the .app bundle (4 levels up from executable)
 * - Windows/Linux tar.gz: In the app directory (via getAppPath)
 * - Development: Current working directory
 *
 * @param app - Electron app object (from 'electron' or '@electron/remote')
 * @param isDev - Whether running in development mode
 * @returns Absolute path to resources directory
 */
export function getResourcesPath(app: ElectronApp, isDev: boolean): string {
    if (isDev) {
        return process.cwd();
    }

    // AppImage: extraFiles are at the mount root (parent of resources/)
    if (process.env.APPIMAGE) {
        return path.dirname(process.resourcesPath);
    }

    // macOS production: resources are outside the .app bundle
    if (process.platform === "darwin") {
        // exe is at: MyApp.app/Contents/MacOS/MyApp
        // resources are at the parent of .app directory
        return path.dirname(path.dirname(path.dirname(path.dirname(app.getPath("exe")))));
    }

    // Windows and Linux tar.gz: resources are in the app directory
    return path.dirname(app.getPath("exe"));
}
