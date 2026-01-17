import { getResourcesPath } from "./ResourcePath";
import * as path from "path";

describe("getResourcesPath", () => {
    // Mock Electron app object
    const createMockApp = (exePath: string, appPath: string) => ({
        getPath: (name: string) => {
            if (name === "exe") return exePath;
            throw new Error(`Unexpected getPath: ${name}`);
        },
        getAppPath: () => appPath,
    });

    // Save original values
    const originalPlatform = process.platform;
    const originalCwd = process.cwd;
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment before each test
        process.env = { ...originalEnv };
        delete process.env.APPIMAGE;
    });

    afterAll(() => {
        // Restore original values
        Object.defineProperty(process, "platform", { value: originalPlatform });
        process.cwd = originalCwd;
        process.env = originalEnv;
    });

    describe("Development mode", () => {
        it("should return process.cwd() on Linux dev", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.cwd = jest.fn(() => "/home/user/Projects/exogui");

            const app = createMockApp(
                "/home/user/Projects/exogui/build/main/index.js",
                "/home/user/Projects/exogui/build"
            );

            expect(getResourcesPath(app, true)).toBe("/home/user/Projects/exogui");
        });

        it("should return process.cwd() on Windows dev", () => {
            Object.defineProperty(process, "platform", { value: "win32" });
            process.cwd = jest.fn(() => "C:\\Users\\user\\Projects\\exogui");

            const app = createMockApp(
                "C:\\Users\\user\\Projects\\exogui\\build\\main\\index.js",
                "C:\\Users\\user\\Projects\\exogui\\build"
            );

            expect(getResourcesPath(app, true)).toBe("C:\\Users\\user\\Projects\\exogui");
        });

        it("should return process.cwd() on macOS dev", () => {
            Object.defineProperty(process, "platform", { value: "darwin" });
            process.cwd = jest.fn(() => "/Users/user/Projects/exogui");

            const app = createMockApp(
                "/Users/user/Projects/exogui/build/main/index.js",
                "/Users/user/Projects/exogui/build"
            );

            expect(getResourcesPath(app, true)).toBe("/Users/user/Projects/exogui");
        });
    });

    describe("Linux AppImage", () => {
        it("should return mount root (parent of resources/) for AppImage", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/home/user/Downloads/exogui-1.2.1.AppImage";

            // AppImage mounts to /tmp/.mount_exoguiXXXXXX/
            // process.resourcesPath points to /tmp/.mount_exoguiXXXXXX/resources/
            Object.defineProperty(process, "resourcesPath", {
                value: "/tmp/.mount_exoguiNQEHj1/resources",
                writable: true,
                configurable: true
            });

            const app = createMockApp(
                "/tmp/.mount_exoguiNQEHj1/exogui",
                "/tmp/.mount_exoguiNQEHj1/resources/app.asar"
            );

            // Should return mount root where extraFiles are located
            expect(getResourcesPath(app, false)).toBe("/tmp/.mount_exoguiNQEHj1");
        });
    });

    describe("Linux tar.gz extraction", () => {
        it("should return process.cwd() for extracted tar.gz", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            // No APPIMAGE env var
            process.cwd = jest.fn(() => "/media/mariuszek/Elements/eXo/eXoDOS/exogui");

            const app = createMockApp(
                "/media/mariuszek/Elements/eXo/eXoDOS/exogui/exogui",
                "/media/mariuszek/Elements/eXo/eXoDOS/exogui/resources/app.asar"
            );

            expect(getResourcesPath(app, false)).toBe("/media/mariuszek/Elements/eXo/eXoDOS/exogui");
        });

        it("should return process.cwd() when run from custom location", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.cwd = jest.fn(() => "/opt/exogui");

            const app = createMockApp(
                "/opt/exogui/exogui",
                "/opt/exogui/resources/app.asar"
            );

            expect(getResourcesPath(app, false)).toBe("/opt/exogui");
        });
    });

    describe("Windows production", () => {
        it("should return process.cwd() for Windows installer", () => {
            Object.defineProperty(process, "platform", { value: "win32" });
            process.cwd = jest.fn(() => "C:\\Program Files\\exogui");

            const app = createMockApp(
                "C:\\Program Files\\exogui\\exogui.exe",
                "C:\\Program Files\\exogui\\resources\\app.asar"
            );

            expect(getResourcesPath(app, false)).toBe("C:\\Program Files\\exogui");
        });

        it("should return process.cwd() for Windows portable zip", () => {
            Object.defineProperty(process, "platform", { value: "win32" });
            process.cwd = jest.fn(() => "C:\\Users\\user\\Desktop\\exogui");

            const app = createMockApp(
                "C:\\Users\\user\\Desktop\\exogui\\exogui.exe",
                "C:\\Users\\user\\Desktop\\exogui\\resources\\app.asar"
            );

            expect(getResourcesPath(app, false)).toBe("C:\\Users\\user\\Desktop\\exogui");
        });
    });

    describe("macOS production", () => {
        it("should return parent of .app bundle for macOS", () => {
            Object.defineProperty(process, "platform", { value: "darwin" });
            process.cwd = jest.fn(() => "/");

            const app = createMockApp(
                "/Applications/exogui.app/Contents/MacOS/exogui",
                "/Applications/exogui.app/Contents/Resources/app.asar"
            );

            // Should go 4 levels up from exe:
            // /Applications/exogui.app/Contents/MacOS/exogui
            // -> /Applications/exogui.app/Contents/MacOS
            // -> /Applications/exogui.app/Contents
            // -> /Applications/exogui.app
            // -> /Applications
            expect(getResourcesPath(app, false)).toBe("/Applications");
        });

        it("should return correct path for macOS in user Applications folder", () => {
            Object.defineProperty(process, "platform", { value: "darwin" });
            process.cwd = jest.fn(() => "/");

            const app = createMockApp(
                "/Users/john/Applications/exogui.app/Contents/MacOS/exogui",
                "/Users/john/Applications/exogui.app/Contents/Resources/app.asar"
            );

            expect(getResourcesPath(app, false)).toBe("/Users/john/Applications");
        });
    });

    describe("Real-world path verification", () => {
        it("should find mappings.linux.json in AppImage mount root", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.env.APPIMAGE = "/home/user/exogui.AppImage";
            Object.defineProperty(process, "resourcesPath", {
                value: "/tmp/.mount_exoguiXXX/resources",
                writable: true,
                configurable: true
            });

            const app = createMockApp(
                "/tmp/.mount_exoguiXXX/exogui",
                "/tmp/.mount_exoguiXXX/resources/app.asar"
            );

            const basePath = getResourcesPath(app, false);
            const mappingsPath = path.join(basePath, "mappings.linux.json");

            // Should construct path to: /tmp/.mount_exoguiXXX/mappings.linux.json
            expect(mappingsPath).toBe("/tmp/.mount_exoguiXXX/mappings.linux.json");
        });

        it("should find 7zip binary in tar.gz extraction", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.cwd = jest.fn(() => "/opt/exogui");

            const app = createMockApp(
                "/opt/exogui/exogui",
                "/opt/exogui/resources/app.asar"
            );

            const basePath = getResourcesPath(app, false);
            const sevenZipPath = path.join(basePath, "extern/7zip-bin/linux/x64/7za");

            // Should construct path to: /opt/exogui/extern/7zip-bin/linux/x64/7za
            expect(sevenZipPath).toBe("/opt/exogui/extern/7zip-bin/linux/x64/7za");
        });

        it("should find platform_options.json in dev mode", () => {
            Object.defineProperty(process, "platform", { value: "linux" });
            process.cwd = jest.fn(() => "/home/user/Projects/exogui-launcher");

            const app = createMockApp(
                "/home/user/Projects/exogui-launcher/build/main/index.js",
                "/home/user/Projects/exogui-launcher/build"
            );

            const basePath = getResourcesPath(app, true);
            const platformOptionsPath = path.join(basePath, "platform_options.json");

            // Should construct path to: /home/user/Projects/exogui-launcher/platform_options.json
            expect(platformOptionsPath).toBe("/home/user/Projects/exogui-launcher/platform_options.json");
        });
    });
});
