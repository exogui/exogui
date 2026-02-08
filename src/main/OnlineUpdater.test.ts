import { OnlineUpdater, OnlineUpdaterConfig, OnlineUpdaterCallbacks } from "./OnlineUpdater";
import { autoUpdater } from "electron-updater";

// Mock electron and electron-updater
jest.mock("electron", () => ({
    app: {
        isPackaged: true,
    },
    dialog: {
        showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
    },
    BrowserWindow: jest.fn(),
}));

jest.mock("electron-updater", () => ({
    autoUpdater: {
        autoDownload: true,
        autoInstallOnAppQuit: false,
        allowDowngrade: false,
        logger: null,
        on: jest.fn(),
        removeAllListeners: jest.fn(),
        checkForUpdates: jest.fn().mockResolvedValue({
            updateInfo: {
                version: "1.2.4",
                releaseDate: "2026-01-18",
            },
        }),
        downloadUpdate: jest.fn().mockResolvedValue(undefined),
        quitAndInstall: jest.fn(),
    },
}));

describe("OnlineUpdater", () => {
    let originalPlatform: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        // Save original values
        originalPlatform = process.platform;
        originalEnv = { ...process.env };

        // Reset mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Restore original values
        Object.defineProperty(process, "platform", {
            value: originalPlatform,
            writable: true,
        });
        process.env = originalEnv;
    });

    describe("Platform Support Detection", () => {
        test("is available on Linux with APPIMAGE env var in production", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/path/to/app.AppImage";
            process.env.NODE_ENV = "production";

            const updater = new OnlineUpdater();
            const state = updater.getState();

            expect(state.available).toBe(true);
            expect(state.enabled).toBe(true);
        });

        test("is not available on Linux without APPIMAGE env var", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            delete process.env.APPIMAGE;
            process.env.NODE_ENV = "production";

            const updater = new OnlineUpdater();
            const state = updater.getState();

            expect(state.available).toBe(false);
            expect(state.enabled).toBe(false);
        });

        test("is not available on Windows", () => {
            Object.defineProperty(process, "platform", { value: "win32" });
            process.env.NODE_ENV = "production";

            const updater = new OnlineUpdater();
            const state = updater.getState();

            expect(state.available).toBe(false);
            expect(state.enabled).toBe(false);
        });

        test("is not available on macOS", () => {
            Object.defineProperty(process, "platform", { value: "darwin" });
            process.env.NODE_ENV = "production";

            const updater = new OnlineUpdater();
            const state = updater.getState();

            expect(state.available).toBe(false);
            expect(state.enabled).toBe(false);
        });

        test("is not available in development mode", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/path/to/app.AppImage";
            process.env.NODE_ENV = "development";

            const updater = new OnlineUpdater();
            const state = updater.getState();

            expect(state.available).toBe(false);
            expect(state.enabled).toBe(false);
        });
    });

    describe("Configuration", () => {
        beforeEach(() => {
            // Setup for Linux AppImage
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/path/to/app.AppImage";
            process.env.NODE_ENV = "production";
        });

        test("uses default configuration when none provided", () => {
            const updater = new OnlineUpdater();
            const state = updater.getState();

            expect(state.enabled).toBe(true);
        });

        test("respects enabled:false in config", () => {
            const config: Partial<OnlineUpdaterConfig> = {
                enabled: false,
            };

            const updater = new OnlineUpdater(config);
            const state = updater.getState();

            expect(state.enabled).toBe(false);
        });

        test("respects custom configuration", () => {
            const config: Partial<OnlineUpdaterConfig> = {
                enabled: true,
                checkOnStartup: false,
                autoDownload: false,
                autoInstallOnQuit: true,
            };

            const updater = new OnlineUpdater(config);
            // Just verify it doesn't throw - actual config is private
            expect(updater).toBeDefined();
        });

        test("allows updating configuration after construction", () => {
            const updater = new OnlineUpdater({ enabled: true });

            updater.updateConfig({ enabled: false });
            let state = updater.getState();
            expect(state.enabled).toBe(false);

            updater.updateConfig({ enabled: true });
            state = updater.getState();
            expect(state.enabled).toBe(true);
        });
    });

    describe("State Management", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/path/to/app.AppImage";
            process.env.NODE_ENV = "production";
        });

        test("initial state is correct", () => {
            const updater = new OnlineUpdater();
            const state = updater.getState();

            expect(state.status).toBe("idle");
            expect(state.downloadProgress).toBe(0);
            expect(state.updateInfo).toBeUndefined();
            expect(state.lastError).toBeUndefined();
        });

        test("getState returns a copy, not reference", () => {
            const updater = new OnlineUpdater();
            const state1 = updater.getState();
            const state2 = updater.getState();

            expect(state1).toEqual(state2);
            expect(state1).not.toBe(state2); // Different objects
        });
    });

    describe("Callback Handling", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/path/to/app.AppImage";
            process.env.NODE_ENV = "production";
        });

        test("accepts callbacks in constructor", () => {
            const callbacks: OnlineUpdaterCallbacks = {
                onUpdateAvailable: jest.fn(),
                onUpdateNotAvailable: jest.fn(),
                onUpdateDownloaded: jest.fn(),
                onError: jest.fn(),
                onDownloadProgress: jest.fn(),
            };

            const updater = new OnlineUpdater({}, callbacks);
            expect(updater).toBeDefined();
        });

        test("works without callbacks", () => {
            const updater = new OnlineUpdater();
            expect(updater).toBeDefined();
        });
    });

    describe("Cleanup", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/path/to/app.AppImage";
            process.env.NODE_ENV = "production";
        });

        test("cleanup removes listeners", async () => {
            const updater = new OnlineUpdater();

            await new Promise((resolve) => setTimeout(resolve, 10));

            updater.cleanup();

            expect(autoUpdater.removeAllListeners).toHaveBeenCalled();
        });

        test("cleanup can be called multiple times", () => {
            const updater = new OnlineUpdater();

            updater.cleanup();
            updater.cleanup();

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe("Edge Cases", () => {
        test("handles missing process.env gracefully", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            const originalAppImage = process.env.APPIMAGE;
            delete process.env.APPIMAGE;

            const updater = new OnlineUpdater();
            const state = updater.getState();

            expect(state.available).toBe(false);
            expect(state.enabled).toBe(false);

            // Restore
            if (originalAppImage) {
                process.env.APPIMAGE = originalAppImage;
            }
        });

        test("disabled updater methods return early without errors", () => {
            Object.defineProperty(process, "platform", { value: "win32" }); // Not supported

            const updater = new OnlineUpdater();

            // These should all return early without throwing
            updater.start();
            updater.quitAndInstall();

            expect(true).toBe(true); // If we get here, no errors were thrown
        });
    });

    describe("Async Event Handlers", () => {
        let mockWindow: any;

        beforeEach(() => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/path/to/app.AppImage";
            process.env.NODE_ENV = "production";

            mockWindow = {
                webContents: {
                    send: jest.fn(),
                },
            };
        });

        test("checking-for-update transitions to checking state", async () => {
            const updater = new OnlineUpdater();
            await new Promise((resolve) => setTimeout(resolve, 10));

            const checkingHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "checking-for-update"
            )?.[1];

            expect(checkingHandler).toBeDefined();
            checkingHandler();

            const state = updater.getState();
            expect(state.status).toBe("checking");
        });

        test("update-available transitions to available state and calls callback", async () => {
            const onUpdateAvailable = jest.fn();
            const updater = new OnlineUpdater({}, { onUpdateAvailable });
            await new Promise((resolve) => setTimeout(resolve, 10));

            const updateInfo = {
                version: "1.3.0",
                releaseDate: "2026-02-08",
            };

            const updateAvailableHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "update-available"
            )?.[1];

            expect(updateAvailableHandler).toBeDefined();
            updateAvailableHandler(updateInfo);

            const state = updater.getState();
            expect(state.status).toBe("available");
            expect(state.updateInfo).toEqual(updateInfo);
            expect(onUpdateAvailable).toHaveBeenCalledWith(updateInfo);
        });

        test("update-not-available transitions to idle state and calls callback", async () => {
            const onUpdateNotAvailable = jest.fn();
            const updater = new OnlineUpdater({}, { onUpdateNotAvailable });
            await new Promise((resolve) => setTimeout(resolve, 10));

            const updateInfo = {
                version: "1.2.4",
                releaseDate: "2026-01-18",
            };

            const updateNotAvailableHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "update-not-available"
            )?.[1];

            expect(updateNotAvailableHandler).toBeDefined();
            updateNotAvailableHandler(updateInfo);

            const state = updater.getState();
            expect(state.status).toBe("idle");
            expect(state.updateInfo).toEqual(updateInfo);
            expect(onUpdateNotAvailable).toHaveBeenCalledWith(updateInfo);
        });

        test("download-progress transitions to downloading state and sends IPC", async () => {
            const onDownloadProgress = jest.fn();
            const updater = new OnlineUpdater({}, { onDownloadProgress });
            updater.setMainWindow(mockWindow);
            await new Promise((resolve) => setTimeout(resolve, 10));

            const progressData = {
                percent: 50.5,
                transferred: 1024000,
                total: 2048000,
                bytesPerSecond: 102400,
            };

            const downloadProgressHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "download-progress"
            )?.[1];

            expect(downloadProgressHandler).toBeDefined();
            downloadProgressHandler(progressData);

            const state = updater.getState();
            expect(state.status).toBe("downloading");
            expect(state.downloadProgress).toBe(50.5);
            expect(onDownloadProgress).toHaveBeenCalledWith({
                percent: 50.5,
                transferred: 1024000,
                total: 2048000,
            });
            expect(mockWindow.webContents.send).toHaveBeenCalledWith(
                "updater:download-progress",
                expect.objectContaining({
                    percent: 50.5,
                    transferred: 1024000,
                    total: 2048000,
                    bytesPerSecond: 102400,
                })
            );
        });

        test("update-downloaded transitions to downloaded state and calls callback", async () => {
            const onUpdateDownloaded = jest.fn();
            const updater = new OnlineUpdater({}, { onUpdateDownloaded });
            await new Promise((resolve) => setTimeout(resolve, 10));

            const updateInfo = {
                version: "1.3.0",
                releaseDate: "2026-02-08",
            };

            const updateDownloadedHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "update-downloaded"
            )?.[1];

            expect(updateDownloadedHandler).toBeDefined();
            updateDownloadedHandler(updateInfo);

            const state = updater.getState();
            expect(state.status).toBe("downloaded");
            expect(state.downloadProgress).toBe(100);
            expect(state.updateInfo).toEqual(updateInfo);
            expect(onUpdateDownloaded).toHaveBeenCalledWith(updateInfo);
        });

        test("error transitions to error state and sends IPC", async () => {
            const onError = jest.fn();
            const updater = new OnlineUpdater({}, { onError });
            updater.setMainWindow(mockWindow);
            await new Promise((resolve) => setTimeout(resolve, 10));

            const error = new Error("Network timeout");

            const errorHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "error"
            )?.[1];

            expect(errorHandler).toBeDefined();
            errorHandler(error);

            const state = updater.getState();
            expect(state.status).toBe("error");
            expect(state.lastError).toBe(error);
            expect(onError).toHaveBeenCalledWith(error);
            expect(mockWindow.webContents.send).toHaveBeenCalledWith(
                "updater:error",
                expect.objectContaining({
                    message: "Network timeout",
                })
            );
        });

        test("download-progress without mainWindow does not throw", async () => {
            const updater = new OnlineUpdater();
            await new Promise((resolve) => setTimeout(resolve, 10));

            const progressData = { percent: 25, transferred: 512000, total: 2048000 };

            const downloadProgressHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "download-progress"
            )?.[1];

            expect(downloadProgressHandler).toBeDefined();
            expect(() => downloadProgressHandler(progressData)).not.toThrow();

            const state = updater.getState();
            expect(state.status).toBe("downloading");
        });

        test("error without mainWindow does not throw", async () => {
            const updater = new OnlineUpdater();
            await new Promise((resolve) => setTimeout(resolve, 10));

            const error = new Error("Test error");

            const errorHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "error"
            )?.[1];

            expect(errorHandler).toBeDefined();
            expect(() => errorHandler(error)).not.toThrow();

            const state = updater.getState();
            expect(state.status).toBe("error");
        });
    });

    describe("State Transitions", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/path/to/app.AppImage";
            process.env.NODE_ENV = "production";
        });

        test("complete update flow: idle → checking → available → downloading → downloaded", async () => {
            const updater = new OnlineUpdater();
            await new Promise((resolve) => setTimeout(resolve, 10));

            let state = updater.getState();
            expect(state.status).toBe("idle");

            const checkingHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "checking-for-update"
            )?.[1];
            checkingHandler();
            state = updater.getState();
            expect(state.status).toBe("checking");

            const updateAvailableHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "update-available"
            )?.[1];
            updateAvailableHandler({ version: "1.3.0" });
            state = updater.getState();
            expect(state.status).toBe("available");

            const downloadProgressHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "download-progress"
            )?.[1];
            downloadProgressHandler({ percent: 75, transferred: 1536000, total: 2048000 });
            state = updater.getState();
            expect(state.status).toBe("downloading");
            expect(state.downloadProgress).toBe(75);

            const updateDownloadedHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "update-downloaded"
            )?.[1];
            updateDownloadedHandler({ version: "1.3.0" });
            state = updater.getState();
            expect(state.status).toBe("downloaded");
            expect(state.downloadProgress).toBe(100);
        });

        test("no update flow: idle → checking → idle", async () => {
            const updater = new OnlineUpdater();
            await new Promise((resolve) => setTimeout(resolve, 10));

            let state = updater.getState();
            expect(state.status).toBe("idle");

            const checkingHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "checking-for-update"
            )?.[1];
            checkingHandler();
            state = updater.getState();
            expect(state.status).toBe("checking");

            const updateNotAvailableHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "update-not-available"
            )?.[1];
            updateNotAvailableHandler({ version: "1.2.4" });
            state = updater.getState();
            expect(state.status).toBe("idle");
        });

        test("error can occur at any point", async () => {
            const updater = new OnlineUpdater();
            await new Promise((resolve) => setTimeout(resolve, 10));

            const errorHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "error"
            )?.[1];

            const checkingHandler = (autoUpdater.on as jest.Mock).mock.calls.find(
                (call) => call[0] === "checking-for-update"
            )?.[1];
            checkingHandler();
            let state = updater.getState();
            expect(state.status).toBe("checking");

            errorHandler(new Error("Network error"));
            state = updater.getState();
            expect(state.status).toBe("error");
            expect(state.lastError?.message).toBe("Network error");
        });
    });
});
