import { IAppConfigData } from "@shared/config/interfaces";

/** Config the running processes were started with. Captured once, after the renderer
 *  is initialized, so it never follows later edits made on the config page. */
let snapshot: Readonly<IAppConfigData> | undefined;

export function captureStartupConfig(): void {
    if (snapshot) return;
    const data = window.External.config.data;
    snapshot = Object.freeze({
        ...data,
        nativePlatforms: [...data.nativePlatforms],
    });
}

export function getStartupConfig(): Readonly<IAppConfigData> {
    if (!snapshot) {
        throw new Error("Startup config was read before it was captured.");
    }
    return snapshot;
}
