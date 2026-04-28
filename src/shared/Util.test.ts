import * as fs from "fs";
import {
    extractTitleFromMediaPath,
    fixSlashes,
    getRelativePath,
    removeFileExtension,
    resolvePathSegmentCaseInsensitive,
    resolvePathSegmentCaseInsensitiveAsync,
} from "./Util";

jest.mock("fs", () => ({
    readdirSync: jest.fn(),
    promises: {
        readdir: jest.fn(),
    },
}));

const mockReaddirSync = fs.readdirSync as jest.Mock;
const mockReaddirAsync = fs.promises.readdir as jest.Mock;

describe("resolvePathSegmentCaseInsensitive", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns the entry with matching casing", () => {
        mockReaddirSync.mockReturnValue(["Extras", "Magazines"]);
        expect(resolvePathSegmentCaseInsensitive("/base", "Extras")).toBe("Extras");
    });

    it("returns the entry when segment casing differs from filesystem entry", () => {
        mockReaddirSync.mockReturnValue(["extras", "magazines"]);
        expect(resolvePathSegmentCaseInsensitive("/base", "Extras")).toBe("extras");
    });

    it("returns the entry when filesystem entry uses uppercase", () => {
        mockReaddirSync.mockReturnValue(["EXTRAS"]);
        expect(resolvePathSegmentCaseInsensitive("/base", "Extras")).toBe("EXTRAS");
    });

    it("returns undefined when no matching entry exists", () => {
        mockReaddirSync.mockReturnValue(["Manuals", "Music"]);
        expect(resolvePathSegmentCaseInsensitive("/base", "Extras")).toBeUndefined();
    });

    it("returns undefined when directory does not exist", () => {
        mockReaddirSync.mockImplementation(() => {
            const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
            err.code = "ENOENT";
            throw err;
        });
        expect(resolvePathSegmentCaseInsensitive("/nonexistent", "Extras")).toBeUndefined();
    });

    it("returns undefined when directory read fails with other error", () => {
        mockReaddirSync.mockImplementation(() => {
            throw new Error("EPERM: permission denied");
        });
        expect(resolvePathSegmentCaseInsensitive("/protected", "Extras")).toBeUndefined();
    });

    it("returns the first match when multiple entries match case-insensitively", () => {
        mockReaddirSync.mockReturnValue(["extras", "Extras"]);
        expect(resolvePathSegmentCaseInsensitive("/base", "Extras")).toBe("extras");
    });
});

describe("resolvePathSegmentCaseInsensitiveAsync", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns the entry with matching casing", async () => {
        mockReaddirAsync.mockResolvedValue(["Extras", "Magazines"]);
        await expect(resolvePathSegmentCaseInsensitiveAsync("/base", "Extras")).resolves.toBe("Extras");
    });

    it("returns the entry when segment casing differs from filesystem entry", async () => {
        mockReaddirAsync.mockResolvedValue(["extras", "magazines"]);
        await expect(resolvePathSegmentCaseInsensitiveAsync("/base", "Extras")).resolves.toBe("extras");
    });

    it("returns the entry when filesystem entry uses uppercase", async () => {
        mockReaddirAsync.mockResolvedValue(["EXTRAS"]);
        await expect(resolvePathSegmentCaseInsensitiveAsync("/base", "Extras")).resolves.toBe("EXTRAS");
    });

    it("returns undefined when no matching entry exists", async () => {
        mockReaddirAsync.mockResolvedValue(["Manuals", "Music"]);
        await expect(resolvePathSegmentCaseInsensitiveAsync("/base", "Extras")).resolves.toBeUndefined();
    });

    it("returns undefined when directory does not exist", async () => {
        const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        mockReaddirAsync.mockRejectedValue(err);
        await expect(resolvePathSegmentCaseInsensitiveAsync("/nonexistent", "Extras")).resolves.toBeUndefined();
    });

    it("returns undefined when directory read fails with other error", async () => {
        mockReaddirAsync.mockRejectedValue(new Error("EPERM: permission denied"));
        await expect(resolvePathSegmentCaseInsensitiveAsync("/protected", "Extras")).resolves.toBeUndefined();
    });
});

// GREEN: existing utility functions
describe("fixSlashes", () => {
    it("converts backslashes to forward slashes", () => {
        expect(fixSlashes("C:\\eXoDOS\\Videos\\MS-DOS")).toBe("C:/eXoDOS/Videos/MS-DOS");
    });

    it("leaves forward slashes unchanged", () => {
        expect(fixSlashes("/home/user/exodos/Videos/MS-DOS")).toBe("/home/user/exodos/Videos/MS-DOS");
    });

    it("handles mixed separators", () => {
        expect(fixSlashes("C:/eXoDOS\\Videos/MS-DOS")).toBe("C:/eXoDOS/Videos/MS-DOS");
    });

    it("handles empty string", () => {
        expect(fixSlashes("")).toBe("");
    });
});

describe("removeFileExtension", () => {
    it("removes extension from simple filename", () => {
        expect(removeFileExtension("GAMENAME.mp4")).toBe("GAMENAME");
    });

    it("removes last extension when filename has multiple dots", () => {
        expect(removeFileExtension("game.name.bat")).toBe("game.name");
    });

    it("returns filename unchanged when there is no extension", () => {
        expect(removeFileExtension("GAMENAME")).toBe("GAMENAME");
    });

    it("removes pdf extension", () => {
        expect(removeFileExtension("GAMENAME.pdf")).toBe("GAMENAME");
    });
});

// RED: getRelativePath does not exist yet
describe("getRelativePath", () => {
    it("extracts relative path from a Unix absolute path", () => {
        expect(getRelativePath(
            "/home/user/exodos/Videos/MS-DOS/GAMENAME.mp4",
            "/home/user/exodos"
        )).toBe("Videos/MS-DOS/GAMENAME.mp4");
    });

    it("extracts relative path from a Windows-style backslash path", () => {
        expect(getRelativePath(
            "C:\\eXoDOS\\Videos\\MS-DOS\\GAMENAME.mp4",
            "C:\\eXoDOS"
        )).toBe("Videos/MS-DOS/GAMENAME.mp4");
    });

    it("handles base path with trailing forward slash", () => {
        expect(getRelativePath(
            "/home/user/exodos/Videos/MS-DOS/GAMENAME.mp4",
            "/home/user/exodos/"
        )).toBe("Videos/MS-DOS/GAMENAME.mp4");
    });

    it("handles base path with trailing backslash", () => {
        expect(getRelativePath(
            "C:\\eXoDOS\\Videos\\MS-DOS\\GAMENAME.mp4",
            "C:\\eXoDOS\\"
        )).toBe("Videos/MS-DOS/GAMENAME.mp4");
    });

    it("always returns forward slashes regardless of input separators", () => {
        const result = getRelativePath(
            "C:\\eXoDOS\\Videos\\MS-DOS\\GAMENAME.mp4",
            "C:\\eXoDOS"
        );
        expect(result).not.toContain("\\");
    });

    it("returns result without a leading slash", () => {
        const result = getRelativePath(
            "/home/user/exodos/Videos/MS-DOS/GAMENAME.mp4",
            "/home/user/exodos"
        );
        expect(result.startsWith("/")).toBe(false);
    });

    it("handles a filename with spaces", () => {
        expect(getRelativePath(
            "/home/user/exodos/Videos/MS-DOS/My Game.mp4",
            "/home/user/exodos"
        )).toBe("Videos/MS-DOS/My Game.mp4");
    });
});

// RED: extractTitleFromMediaPath does not exist yet
describe("extractTitleFromMediaPath", () => {
    it("extracts game title from a Unix video path", () => {
        expect(extractTitleFromMediaPath(
            "/home/user/exodos/Videos/MS-DOS/GAMENAME.mp4",
            "/home/user/exodos"
        )).toBe("GAMENAME");
    });

    it("extracts game title from a Windows-style backslash video path", () => {
        expect(extractTitleFromMediaPath(
            "C:\\eXoDOS\\Videos\\MS-DOS\\GAMENAME.mp4",
            "C:\\eXoDOS"
        )).toBe("GAMENAME");
    });

    it("extracts game title from a Unix manual path", () => {
        expect(extractTitleFromMediaPath(
            "/home/user/exodos/Manuals/MS-DOS/GAMENAME.pdf",
            "/home/user/exodos"
        )).toBe("GAMENAME");
    });

    it("extracts game title from a Windows manual path", () => {
        expect(extractTitleFromMediaPath(
            "C:\\eXoDOS\\Manuals\\MS-DOS\\GAMENAME.pdf",
            "C:\\eXoDOS"
        )).toBe("GAMENAME");
    });

    it("handles filenames with spaces", () => {
        expect(extractTitleFromMediaPath(
            "/home/user/exodos/Videos/MS-DOS/My Game.mp4",
            "/home/user/exodos"
        )).toBe("My Game");
    });

    it("handles Windows base path with trailing backslash", () => {
        expect(extractTitleFromMediaPath(
            "C:\\eXoDOS\\Videos\\MS-DOS\\GAMENAME.mp4",
            "C:\\eXoDOS\\"
        )).toBe("GAMENAME");
    });

    it("produces the same title that getGameByTitle would match against", () => {
        // getGameByTitle compares against path.basename(fixSlashes(applicationPath)).split(".")[0]
        // e.g. applicationPath "eXo\\eXoDOS\\1Ton\\1Ton.bat" -> title "1Ton"
        // video file "C:\eXoDOS\Videos\MS-DOS\1Ton.mp4" -> should also produce "1Ton"
        expect(extractTitleFromMediaPath(
            "C:\\eXoDOS\\Videos\\MS-DOS\\1Ton.mp4",
            "C:\\eXoDOS"
        )).toBe("1Ton");
    });
});
