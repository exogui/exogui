import { app, BrowserWindow } from "electron";
import type { AppUpdater, UpdateInfo } from "electron-updater";
import { UpdaterIPC } from "@shared/interfaces";

export type OnlineUpdaterConfig = {
    /** Enable online updater (only works on supported platforms) */
    enabled: boolean;
    /** Check for updates on startup */
    checkOnStartup: boolean;
    /** Auto-download updates when available */
    autoDownload: boolean;
    /** Auto-install updates on quit */
    autoInstallOnQuit: boolean;
};

export type OnlineUpdaterCallbacks = {
    /** Called when an update is available */
    onUpdateAvailable?: (info: UpdateInfo) => void;
    /** Called when no update is available */
    onUpdateNotAvailable?: (info: UpdateInfo) => void;
    /** Called when an update has been downloaded */
    onUpdateDownloaded?: (info: UpdateInfo) => void;
    /** Called when an error occurs */
    onError?: (error: Error) => void;
    /** Called with download progress updates */
    onDownloadProgress?: (progress: { percent: number; transferred: number; total: number }) => void;
};

export type OnlineUpdaterState = {
    /** Is online updater available on this platform? */
    available: boolean;
    /** Is online updater currently enabled? */
    enabled: boolean;
    /** Current update status */
    status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
    /** Current update info (if available) */
    updateInfo?: UpdateInfo;
    /** Last error (if any) */
    lastError?: Error;
    /** Download progress (0-100) */
    downloadProgress: number;
};

/**
 * OnlineUpdater manager for Linux AppImage builds.
 * Only works when app is packaged as AppImage and published to GitHub Releases.
 */
export class OnlineUpdater {
    private config: OnlineUpdaterConfig;
    private callbacks: OnlineUpdaterCallbacks;
    private state: OnlineUpdaterState;
    private mainWindow?: BrowserWindow;
    private _updater?: AppUpdater;

    constructor(config: Partial<OnlineUpdaterConfig> = {}, callbacks: OnlineUpdaterCallbacks = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            checkOnStartup: config.checkOnStartup ?? true,
            autoDownload: config.autoDownload ?? false,
            autoInstallOnQuit: config.autoInstallOnQuit ?? false,
        };

        this.callbacks = callbacks;

        this.state = {
            available: this.isPlatformSupported(),
            enabled: this.config.enabled && this.isPlatformSupported(),
            status: "idle",
            downloadProgress: 0,
        };

        console.log(`[OnlineUpdater] Initialized. Supported: ${this.state.available}, Enabled: ${this.state.enabled}`);
        if (this.state.enabled) {
            this.initializeUpdater();
        }
    }

    /**
     * Initialize online updater asynchronously.
     */
    private async initializeUpdater(): Promise<void> {
        try {
            await this.loadUpdater();
            this.setupEventHandlers();
            this.configureUpdater();
        } catch (error) {
            console.error("[OnlineUpdater] Failed to initialize:", error);
            this.state.enabled = false;
        }
    }

    /**
     * Lazy-load electron-updater only when needed (production AppImage).
     * This prevents import errors in development mode.
     */
    private async loadUpdater(): Promise<AppUpdater> {
        if (!this._updater) {
            const { autoUpdater } = await import("electron-updater");
            this._updater = autoUpdater;
        }
        return this._updater;
    }

    /**
     * Check if online updater is supported on the current platform.
     * Currently only Linux AppImage is supported.
     */
    private isPlatformSupported(): boolean {
        if (process.platform !== "linux") {
            return false;
        }

        if (!process.env.APPIMAGE) {
            return false;
        }

        if (process.env.NODE_ENV === "development" || !app.isPackaged) {
            return false;
        }

        return true;
    }

    /**
     * Configure electron-updater settings.
     */
    private configureUpdater(): void {
        if (!this._updater) return;
        this._updater.autoDownload = this.config.autoDownload;
        this._updater.autoInstallOnAppQuit = this.config.autoInstallOnQuit;
        this._updater.allowDowngrade = false;
        this._updater.logger = console;
    }

    /**
     * Setup event handlers for electron-updater.
     */
    private setupEventHandlers(): void {
        if (!this._updater) return;

        this._updater.on("checking-for-update", () => {
            console.log("[OnlineUpdater] Checking for updates...");
            this.state.status = "checking";
        });

        this._updater.on("update-available", (info: UpdateInfo) => {
            console.log("[OnlineUpdater] Update available:", info.version);
            this.state.status = "available";
            this.state.updateInfo = info;

            if (this.callbacks.onUpdateAvailable) {
                this.callbacks.onUpdateAvailable(info);
            } else {
                this.showUpdateAvailableNotification(info);
            }
        });

        this._updater.on("update-not-available", (info: UpdateInfo) => {
            console.log("[OnlineUpdater] Update not available. Current version is latest.");
            this.state.status = "idle";
            this.state.updateInfo = info;

            if (this.callbacks.onUpdateNotAvailable) {
                this.callbacks.onUpdateNotAvailable(info);
            }
        });

        this._updater.on("download-progress", (progress) => {
            console.log(`[OnlineUpdater] Download progress: ${progress.percent.toFixed(2)}%`);
            this.state.status = "downloading";
            this.state.downloadProgress = progress.percent;

            if (this.callbacks.onDownloadProgress) {
                this.callbacks.onDownloadProgress({
                    percent: progress.percent,
                    transferred: progress.transferred,
                    total: progress.total,
                });
            }

            if (this.mainWindow) {
                this.mainWindow.webContents.send(UpdaterIPC.UPDATE_DOWNLOAD_PROGRESS, {
                    percent: progress.percent,
                    transferred: progress.transferred,
                    total: progress.total,
                    bytesPerSecond: progress.bytesPerSecond,
                });
            }
        });

        this._updater.on("update-downloaded", (info: UpdateInfo) => {
            console.log("[OnlineUpdater] Update downloaded:", info.version);
            this.state.status = "downloaded";
            this.state.updateInfo = info;
            this.state.downloadProgress = 100;

            if (this.callbacks.onUpdateDownloaded) {
                this.callbacks.onUpdateDownloaded(info);
            } else {
                this.showUpdateDownloadedDialog(info);
            }
        });

        this._updater.on("error", (error: Error) => {
            console.error("[OnlineUpdater] Error:", error);
            this.state.status = "error";
            this.state.lastError = error;

            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }

            if (this.mainWindow) {
                this.mainWindow.webContents.send(UpdaterIPC.UPDATE_ERROR, {
                    message: error.message || "An error occurred while updating",
                    details: error.stack,
                });
            }
        });
    }

    /**
     * Format release notes for display.
     */
    private formatReleaseNotes(releaseNotes: string | Array<{version: string; note: string | null}> | null | undefined): string {
        if (!releaseNotes) {
            return "No release notes available.";
        }

        if (typeof releaseNotes === "string") {
            return releaseNotes;
        }

        return releaseNotes
        .map(note => `Version ${note.version}:\n${note.note || "No description"}`)
        .join("\n\n");
    }

    /**
     * Show notification that update is available with changelog.
     * Asks user for confirmation to download.
     */
    private async showUpdateAvailableNotification(info: UpdateInfo): Promise<void> {
        if (!this.mainWindow) {
            console.warn("[OnlineUpdater] Cannot show update notification: main window not set");
            return;
        }

        const changelog = this.formatReleaseNotes(info.releaseNotes);
        const releaseName = info.releaseName || `Version ${info.version}`;
        const size = info?.files?.[0]?.size ?? 0;

        this.mainWindow.webContents.send(UpdaterIPC.UPDATE_AVAILABLE, {
            version: info.version,
            currentVersion: app.getVersion(),
            releaseName: releaseName,
            releaseNotes: changelog,
            size: size,
        });
    }


    /**
     * Show dialog that update has been downloaded.
     */
    private showUpdateDownloadedDialog(info: UpdateInfo): void {
        if (!this.mainWindow) {
            console.warn("[OnlineUpdater] Cannot show update downloaded notification: main window not set");
            return;
        }

        const releaseName = info.releaseName || `Version ${info.version}`;

        this.mainWindow.webContents.send(UpdaterIPC.UPDATE_DOWNLOADED, {
            version: info.version,
            releaseName: releaseName,
        });
    }

    /**
     * Set the main window reference (for dialogs).
     */
    setMainWindow(window: BrowserWindow): void {
        this.mainWindow = window;
    }

    /**
     * Handle user request to skip the current update.
     */
    handleSkipRequest(): void {
        console.log("[OnlineUpdater] User skipped update");
        this.state.status = "idle";
        this.mainWindow?.webContents.send(UpdaterIPC.UPDATE_CANCELLED);
    }

    /**
     * Handle user request to dismiss error dialog.
     */
    handleDismissError(): void {
        console.log("[OnlineUpdater] Error dismissed by user");
        this.state.status = "idle";
        this.mainWindow?.webContents.send(UpdaterIPC.UPDATE_CANCELLED);
    }

    /**
     * Start checking for updates.
     */
    start(): void {
        if (!this.state.enabled) {
            console.log("[OnlineUpdater] Online updater is disabled or not supported on this platform.");
            return;
        }

        if (this.config.checkOnStartup) {
            console.log("[OnlineUpdater] Checking for updates...");
            this.checkForUpdates();
        }
    }

    /**
     * Manually check for updates.
     */
    async checkForUpdates(): Promise<UpdateInfo | null> {
        if (!this.state.enabled || !this._updater) {
            console.log("[OnlineUpdater] Cannot check for updates: not supported or disabled.");
            return null;
        }

        try {
            const result = await this._updater.checkForUpdates();
            return result?.updateInfo ?? null;
        } catch (error) {
            console.error("[OnlineUpdater] Failed to check for updates:", error);
            return null;
        }
    }

    /**
     * Manually download update (if auto-download is disabled).
     */
    async downloadUpdate(): Promise<void> {
        if (!this.state.enabled || !this._updater) {
            console.log("[OnlineUpdater] Cannot download update: not supported or disabled.");
            return;
        }

        if (this.state.status !== "available") {
            console.log("[OnlineUpdater] No update available to download.");
            return;
        }

        try {
            await this._updater.downloadUpdate();
        } catch (error) {
            console.error("[OnlineUpdater] Failed to download update:", error);
        }
    }

    /**
     * Quit and install the downloaded update.
     */
    quitAndInstall(): void {
        if (!this.state.enabled || !this._updater) {
            console.log("[OnlineUpdater] Cannot install update: not supported or disabled.");
            return;
        }

        if (this.state.status !== "downloaded") {
            console.log("[OnlineUpdater] No update downloaded to install.");
            return;
        }

        console.log("[OnlineUpdater] Quitting and installing update...");
        // isSilent = false, isForceRunAfter = true
        this._updater.quitAndInstall(false, true);
    }

    /**
     * Get current state of the online updater.
     */
    getState(): Readonly<OnlineUpdaterState> {
        return { ...this.state };
    }

    /**
     * Update configuration.
     */
    updateConfig(config: Partial<OnlineUpdaterConfig>): void {
        this.config = { ...this.config, ...config };
        this.state.enabled = this.config.enabled && this.state.available;

        if (this.config.enabled && !this.state.available) {
            console.warn("[OnlineUpdater] Cannot enable updates: not supported on this platform");
        }

        if (this.state.enabled) {
            this.configureUpdater();
        }
    }

    /**
     * Cleanup resources.
     */
    cleanup(): void {
        this._updater?.removeAllListeners();
    }
}
