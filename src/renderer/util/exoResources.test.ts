import * as fs from "fs";
import { getLabel } from "./exoResources";

describe("getLabel", () => {
    it("maps known update script paths to friendly labels", () => {
        expect(getLabel("eXo/Update/update.bat")).toBe("Update Retro eXo Projects");
        expect(getLabel("install_dependencies.command")).toBe("Install dependencies");
    });

    it("keeps single-extension document names", () => {
        expect(getLabel("eXoDOS Catalog.pdf")).toBe("eXoDOS Catalog");
        expect(getLabel("Media Pack ReadMe.txt")).toBe("Media Pack ReadMe");
    });

    it("keeps periods that are part of the filename, not the extension", () => {
        expect(getLabel("exogui.old.command")).toBe("exogui.old");
    });
});

describe("loadExoResources", () => {
    const originalPlatform = process.platform;

    const setPlatform = (platform: NodeJS.Platform) =>
        Object.defineProperty(process, "platform", { value: platform });

    beforeEach(() => {
        (window as any).External = { config: { fullExodosPath: "/test" } };
        jest.spyOn(fs.promises, "readdir").mockResolvedValue([
            "install_dependencies.command",
        ] as any);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
    });

    afterEach(() => {
        setPlatform(originalPlatform);
        jest.restoreAllMocks();
        jest.resetModules();
    });

    const loadScriptsForPlatform = async (platform: NodeJS.Platform) => {
        setPlatform(platform);
        jest.resetModules();
        const { loadExoResources } = await import("./exoResources");
        return (await loadExoResources()).Scripts;
    };

    it.each<NodeJS.Platform>(["linux", "darwin"])(
        "updates via install_dependencies with the update parameter on %s",
        async (platform) => {
            const scripts = await loadScriptsForPlatform(platform);
            expect(scripts).toContainEqual({
                label: "Update Retro eXo Projects",
                filepath: "install_dependencies.command",
                args: "update",
            });
        }
    );

    it("updates via the update script without parameters on windows", async () => {
        const scripts = await loadScriptsForPlatform("win32");
        expect(scripts).toContainEqual({
            label: "Update Retro eXo Projects",
            filepath: "eXo/Update/update.bat",
            args: undefined,
        });
    });
});
