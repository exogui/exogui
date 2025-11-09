import { app } from "@electron/remote";
import * as path from "path";

function get7zExec(): string {
    // Get the base path for external resources
    // On macOS packaged apps, resources are siblings to the .app bundle
    // On dev mode, use process.cwd()
    const basePath = window.External.isDev
        ? process.cwd()
        : (process.platform === 'darwin')
            ? path.dirname(path.dirname(path.dirname(path.dirname(app.getPath("exe")))))
            : app.getAppPath();
    switch (process.platform) {
        case "darwin":
            return path.join(basePath, "extern/7zip-bin/mac", "7za");
        case "win32":
            return path.join(
                basePath,
                "extern/7zip-bin/win",
                process.arch,
                "7za",
            );
        case "linux":
            return path.join(
                basePath,
                "extern/7zip-bin/linux",
                process.arch,
                "7za",
            );
    }
    return "7za";
}

export const pathTo7z = get7zExec();
