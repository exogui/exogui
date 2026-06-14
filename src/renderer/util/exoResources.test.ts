import { getLabel } from "./exoResources";

describe("getLabel", () => {
    it("maps known update script paths to friendly labels", () => {
        expect(getLabel("eXo/Update/update.command")).toBe("Update Retro eXo Projects");
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
