import { autoUpdater, UpdateInfo } from "electron-updater";
import { app, BrowserWindow, dialog } from "electron";

export type AutoUpdaterConfig = {
    /** Enable auto-updater (only works on supported platforms) */
    enabled: boolean;
    /** Check for updates on startup */
    checkOnStartup: boolean;
    /** Delay before checking for updates on startup (ms) */
    startupCheckDelay: number;
    /** Auto-download updates when available */
    autoDownload: boolean;
    /** Auto-install updates on quit */
    autoInstallOnQuit: boolean;
};

export type AutoUpdaterCallbacks = {
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

export type AutoUpdaterState = {
    /** Is auto-updater available on this platform? */
    available: boolean;
    /** Is auto-updater currently enabled? */
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
 * AutoUpdater manager for Linux AppImage builds.
 * Only works when app is packaged as AppImage and published to GitHub Releases.
 */
export class AutoUpdater {
    private config: AutoUpdaterConfig;
    private callbacks: AutoUpdaterCallbacks;
    private state: AutoUpdaterState;
    private mainWindow?: BrowserWindow;
    private updateCheckTimeout?: NodeJS.Timeout;

    constructor(config: Partial<AutoUpdaterConfig> = {}, callbacks: AutoUpdaterCallbacks = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            checkOnStartup: config.checkOnStartup ?? true,
            startupCheckDelay: config.startupCheckDelay ?? 5000,
            autoDownload: config.autoDownload ?? true,
            autoInstallOnQuit: config.autoInstallOnQuit ?? false,
        };

        this.callbacks = callbacks;

        this.state = {
            available: this.isPlatformSupported(),
            enabled: this.config.enabled && this.isPlatformSupported(),
            status: "idle",
            downloadProgress: 0,
        };

        if (this.state.enabled) {
            this.setupEventHandlers();
            this.configureAutoUpdater();
        }
    }

    /**
     * Check if auto-updater is supported on the current platform.
     * Currently only Linux AppImage is supported.
     */
    private isPlatformSupported(): boolean {
        // Only enable for Linux AppImage in production
        if (process.platform !== "linux") {
            return false;
        }

        // Check if running as AppImage
        if (!process.env.APPIMAGE) {
            return false;
        }

        // Check if running in production (packaged app)
        if (process.env.NODE_ENV === "development" || !app.isPackaged) {
            return false;
        }

        return true;
    }

    /**
     * Configure electron-updater settings.
     */
    private configureAutoUpdater(): void {
        // Set auto-download preference
        autoUpdater.autoDownload = this.config.autoDownload;

        // Set auto-install on app quit
        autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnQuit;

        // Allow downgrade (can be useful for rolling back)
        autoUpdater.allowDowngrade = false;

        // Enable logging
        autoUpdater.logger = console;
    }

    /**
     * Setup event handlers for electron-updater.
     */
    private setupEventHandlers(): void {
        autoUpdater.on("checking-for-update", () => {
            console.log("[AutoUpdater] Checking for updates...");
            this.state.status = "checking";
        });

        autoUpdater.on("update-available", (info: UpdateInfo) => {
            console.log("[AutoUpdater] Update available:", info.version);
            this.state.status = "available";
            this.state.updateInfo = info;

            if (this.callbacks.onUpdateAvailable) {
                this.callbacks.onUpdateAvailable(info);
            } else {
                // Default behavior: show notification
                this.showUpdateAvailableNotification(info);
            }
        });

        autoUpdater.on("update-not-available", (info: UpdateInfo) => {
            console.log("[AutoUpdater] Update not available. Current version is latest.");
            this.state.status = "idle";
            this.state.updateInfo = info;

            if (this.callbacks.onUpdateNotAvailable) {
                this.callbacks.onUpdateNotAvailable(info);
            }
        });

        autoUpdater.on("download-progress", (progress) => {
            console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(2)}%`);
            this.state.status = "downloading";
            this.state.downloadProgress = progress.percent;

            if (this.callbacks.onDownloadProgress) {
                this.callbacks.onDownloadProgress({
                    percent: progress.percent,
                    transferred: progress.transferred,
                    total: progress.total,
                });
            }
        });

        autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
            console.log("[AutoUpdater] Update downloaded:", info.version);
            this.state.status = "downloaded";
            this.state.updateInfo = info;
            this.state.downloadProgress = 100;

            if (this.callbacks.onUpdateDownloaded) {
                this.callbacks.onUpdateDownloaded(info);
            } else {
                // Default behavior: prompt user to restart
                this.showUpdateDownloadedDialog(info);
            }
        });

        autoUpdater.on("error", (error: Error) => {
            console.error("[AutoUpdater] Error:", error);
            this.state.status = "error";
            this.state.lastError = error;

            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
        });
    }

    /**
     * Show notification that update is available.
     */
    private showUpdateAvailableNotification(info: UpdateInfo): void {
        if (!this.mainWindow) {
            return;
        }

        dialog.showMessageBox(this.mainWindow, {
            type: "info",
            title: "Update Available",
            message: `A new version (${info.version}) is available.`,
            detail: this.config.autoDownload
                ? "The update will be downloaded in the background."
                : "You can download it from the GitHub releases page.",
            buttons: ["OK"],
        });
    }

    /**
     * Show dialog that update has been downloaded.
     */
    private showUpdateDownloadedDialog(info: UpdateInfo): void {
        if (!this.mainWindow) {
            return;
        }

        dialog.showMessageBox(this.mainWindow, {
            type: "info",
            title: "Update Ready",
            message: `Version ${info.version} has been downloaded.`,
            detail: "The update will be installed when you restart the application.",
            buttons: ["Restart Now", "Later"],
        }).then((result) => {
            if (result.response === 0) {
                // User chose to restart
                this.quitAndInstall();
            }
        });
    }

    /**
     * Set the main window reference (for dialogs).
     */
    setMainWindow(window: BrowserWindow): void {
        this.mainWindow = window;
    }

    /**
     * Start checking for updates.
     * Optionally schedules check after a delay.
     */
    start(): void {
        if (!this.state.enabled) {
            console.log("[AutoUpdater] Auto-updater is disabled or not supported on this platform.");
            return;
        }

        if (this.config.checkOnStartup) {
            console.log(`[AutoUpdater] Scheduling update check in ${this.config.startupCheckDelay}ms...`);
            this.updateCheckTimeout = setTimeout(() => {
                this.checkForUpdates();
            }, this.config.startupCheckDelay);
        }
    }

    /**
     * Manually check for updates.
     */
    async checkForUpdates(): Promise<UpdateInfo | null> {
        if (!this.state.enabled) {
            console.log("[AutoUpdater] Cannot check for updates: not supported or disabled.");
            return null;
        }

        try {
            const result = await autoUpdater.checkForUpdates();
            return result?.updateInfo ?? null;
        } catch (error) {
            console.error("[AutoUpdater] Failed to check for updates:", error);
            return null;
        }
    }

    /**
     * Manually download update (if auto-download is disabled).
     */
    async downloadUpdate(): Promise<void> {
        if (!this.state.enabled) {
            console.log("[AutoUpdater] Cannot download update: not supported or disabled.");
            return;
        }

        if (this.state.status !== "available") {
            console.log("[AutoUpdater] No update available to download.");
            return;
        }

        try {
            await autoUpdater.downloadUpdate();
        } catch (error) {
            console.error("[AutoUpdater] Failed to download update:", error);
        }
    }

    /**
     * Quit and install the downloaded update.
     */
    quitAndInstall(): void {
        if (!this.state.enabled) {
            console.log("[AutoUpdater] Cannot install update: not supported or disabled.");
            return;
        }

        if (this.state.status !== "downloaded") {
            console.log("[AutoUpdater] No update downloaded to install.");
            return;
        }

        console.log("[AutoUpdater] Quitting and installing update...");
        // isSilent = false, isForceRunAfter = true
        autoUpdater.quitAndInstall(false, true);
    }

    /**
     * Get current state of the auto-updater.
     */
    getState(): Readonly<AutoUpdaterState> {
        return { ...this.state };
    }

    /**
     * Update configuration.
     */
    updateConfig(config: Partial<AutoUpdaterConfig>): void {
        this.config = { ...this.config, ...config };

        // Update enabled state
        this.state.enabled = this.config.enabled && this.state.available;

        // Reconfigure if enabled
        if (this.state.enabled) {
            this.configureAutoUpdater();
        }
    }

    /**
     * Cleanup resources.
     */
    cleanup(): void {
        if (this.updateCheckTimeout) {
            clearTimeout(this.updateCheckTimeout);
            this.updateCheckTimeout = undefined;
        }

        // Remove all listeners
        autoUpdater.removeAllListeners();
    }
}
