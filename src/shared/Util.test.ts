import * as fs from "fs";
import {
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
