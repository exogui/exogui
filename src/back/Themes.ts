import * as fs from "fs";
import * as path from "path";
import { ThemeListItem } from "./types";

export async function loadThemes(themeFolderPath: string): Promise<ThemeListItem[]> {
    const themes: ThemeListItem[] = [];

    try {
        const exists = await fs.promises.stat(themeFolderPath).catch(() => null);
        if (!exists || !exists.isDirectory()) {
            console.log(`Theme folder does not exist: ${themeFolderPath}`);
            return themes;
        }

        const entries = await fs.promises.readdir(themeFolderPath, { withFileTypes: true });

        for (const entry of entries) {
            try {
                if (entry.isFile() && entry.name.endsWith(".css")) {
                    const basename = path.basename(entry.name, ".css");
                    const displayName = basename.charAt(0).toUpperCase() + basename.slice(1);

                    themes.push({
                        entryPath: entry.name,
                        meta: { name: displayName },
                        basename: basename,
                    });

                    console.log(`Loaded theme: ${displayName}`);
                }
            } catch (error) {
                console.error(`Error loading theme ${entry.name}: ${error}`);
            }
        }
    } catch (error) {
        console.error(`Error loading themes: ${error}`);
    }

    return themes;
}
