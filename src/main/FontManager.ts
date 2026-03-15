import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Configures fontconfig to use bundled fonts on Linux production builds.
 * Must be called before Electron/Chromium initializes so all subprocesses
 * (renderer, GPU) inherit the FONTCONFIG_FILE environment variable.
 */
export function setupBundledFonts(): void {
    if (process.platform !== "linux") {
        console.log("[FontManager] Skipping — not Linux");
        return;
    }
    if ("ELECTRON_IS_DEV" in process.env) {
        console.log("[FontManager] Skipping — development mode");
        return;
    }

    const fontsDir = path.join(path.dirname(process.execPath), "fonts");
    console.log(`[FontManager] Looking for bundled fonts at: ${fontsDir}`);

    if (!fs.existsSync(fontsDir)) {
        console.log("[FontManager] Fonts directory not found, skipping");
        return;
    }

    const bundledFonts = fs.readdirSync(fontsDir).filter((f) => f.endsWith(".ttf") || f.endsWith(".otf"));
    console.log(`[FontManager] Found ${bundledFonts.length} bundled font(s): ${bundledFonts.join(", ")}`);

    const fontsConf = [
        "<?xml version=\"1.0\"?>",
        "<!DOCTYPE fontconfig SYSTEM \"fonts.dtd\">",
        "<fontconfig>",
        "    <include ignore_missing=\"yes\">/etc/fonts/fonts.conf</include>",
        `    <dir>${fontsDir}</dir>`,
        "</fontconfig>",
    ].join("\n");

    const tmpConf = path.join(os.tmpdir(), "exogui-fonts.conf");
    fs.writeFileSync(tmpConf, fontsConf);
    process.env.FONTCONFIG_FILE = tmpConf;
    console.log(`[FontManager] FONTCONFIG_FILE set to: ${tmpConf}`);
}
