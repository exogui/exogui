import { createCommand } from "./CommandMapping";
import { IAppCommandsMappingData } from "./interfaces";

const mockMappingsLinux: IAppCommandsMappingData = {
    defaultMapping: {
        extensions: [],
        command: "xdg-open",
        includeFilename: true,
        includeArgs: true
    },
    commandsMapping: [
        {
            extensions: ["exe"],
            command: "flatpak run com.retro_exo.wine",
            includeFilename: true,
            includeArgs: true
        },
        {
            extensions: ["command"],
            command: "",
            includeFilename: true,
            includeArgs: true
        }
    ]
};

const mockMappingsWindows: IAppCommandsMappingData = {
    defaultMapping: {
        extensions: [],
        command: "start \"\"",
        includeFilename: true,
        includeArgs: true,
        setCwdToFileDir: true
    },
    commandsMapping: [
        {
            extensions: ["command"],
            command: "",
            includeFilename: true,
            includeArgs: true,
            setCwdToFileDir: false
        }
    ]
};

describe("CommandMapping.createCommand", () => {
    const originalPlatform = process.platform;

    afterEach(() => {
        Object.defineProperty(process, "platform", {
            value: originalPlatform
        });
    });

    describe("Linux platform", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", {
                value: "linux"
            });
        });

        it("should create command for .exe file with Wine", () => {
            const result = createCommand(
                "/exodos/Games/Doom/DOOM.exe",
                "-fullscreen",
                mockMappingsLinux
            );

            expect(result.command).toContain("flatpak run com.retro_exo.wine");
            expect(result.command).toContain("DOOM.exe");
            expect(result.command).toContain("-fullscreen");
        });

        it("should escape special characters in path", () => {
            const result = createCommand(
                "/exodos/My Games/Test Game/game.exe",
                "",
                mockMappingsLinux
            );

            expect(result.command).toContain("\\ ");
        });

        it("should create command for .command file", () => {
            const result = createCommand(
                "/exodos/Games/Doom/DOOM.command",
                "-arg1",
                mockMappingsLinux
            );

            expect(result.command).toContain("/exodos/Games/Doom/DOOM.command");
            expect(result.command).toContain("-arg1");
        });

        it("should handle foobar2000.exe with special Wine setup", () => {
            const result = createCommand(
                "/exodos/Music/Soundtrack/foobar2000.exe",
                "playlist.m3u",
                mockMappingsLinux
            );

            expect(result.cwd).toBe("/exodos/Music/Soundtrack/");
            expect(result.command).toContain("flatpak run com.retro_exo.wine");
            expect(result.command).toContain("foobar2000.exe");
            expect(result.command).toContain("playlist.m3u");
        });

        it("should use default mapping for unknown extension", () => {
            const result = createCommand(
                "/exodos/Docs/manual.pdf",
                "",
                mockMappingsLinux
            );

            expect(result.command).toContain("xdg-open");
            expect(result.command).toContain("manual.pdf");
        });
    });

    describe("Windows platform", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", {
                value: "win32"
            });
        });

        it("should create command with Windows path separators", () => {
            const result = createCommand(
                "C:/exodos/Games/Doom/DOOM.exe",
                "-fullscreen",
                mockMappingsWindows
            );

            expect(result.command).toContain("C:\\exodos\\Games\\Doom\\DOOM.exe");
        });

        it("should quote filename with spaces", () => {
            const result = createCommand(
                "C:/exodos/My Games/Test Game/game.exe",
                "",
                mockMappingsWindows
            );

            expect(result.command).toMatch(/"C:\\exodos\\My Games\\Test Game\\game\.exe"/);
        });

        it("should set working directory for default mapping", () => {
            const result = createCommand(
                "C:/exodos/Games/Doom/DOOM.bat",
                "",
                mockMappingsWindows
            );

            expect(result.cwd).toBe("C:\\exodos\\Games\\Doom");
        });

        it("should NOT handle foobar2000.exe specially on Windows", () => {
            const result = createCommand(
                "C:/exodos/Music/Soundtrack/foobar2000.exe",
                "playlist.m3u",
                mockMappingsWindows
            );

            expect(result.command).toContain("start \"\"");
            expect(result.command).toContain("C:\\exodos\\Music\\Soundtrack\\foobar2000.exe");
        });
    });

    describe("macOS platform", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", {
                value: "darwin"
            });
        });

        it("should escape special characters like Linux", () => {
            const result = createCommand(
                "/exodos/My Games/Test Game/game.exe",
                "",
                mockMappingsLinux
            );

            expect(result.command).toContain("\\ ");
        });

        it("should handle foobar2000.exe with Wine on macOS", () => {
            const result = createCommand(
                "/exodos/Music/Soundtrack/foobar2000.exe",
                "playlist.m3u",
                mockMappingsLinux
            );

            expect(result.cwd).toBe("/exodos/Music/Soundtrack/");
            expect(result.command).toContain("flatpak run com.retro_exo.wine");
        });
    });

    describe("Edge cases", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", {
                value: "linux"
            });
        });

        it("should handle empty args", () => {
            const result = createCommand(
                "/exodos/Games/game.exe",
                "",
                mockMappingsLinux
            );

            expect(result.command).not.toContain("undefined");
            expect(result.command).toBe(result.command.trim());
        });

        it("should handle args with quotes", () => {
            const result = createCommand(
                "/exodos/Games/game.exe",
                "-title=\"My Game\"",
                mockMappingsLinux
            );

            expect(result.command).toContain("My Game");
        });

        it("should handle mixed path separators", () => {
            const result = createCommand(
                "/exodos\\Games/Doom\\DOOM.exe",
                "",
                mockMappingsLinux
            );

            expect(result.command).toBeDefined();
        });
    });
});
