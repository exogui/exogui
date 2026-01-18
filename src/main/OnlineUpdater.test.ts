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
});
