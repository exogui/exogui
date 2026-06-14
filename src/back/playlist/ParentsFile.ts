import { XMLParser } from "fast-xml-parser";
import * as fs from "fs";

export namespace ParentsFile {
    /**
     * Read Parents.xml and build a map of playlist id to the platform (library)
     * the playlist belongs to.
     * @param filePath Path of the Parents.xml file.
     */
    export async function readPlaylistPlatformMap(
        filePath: string
    ): Promise<Map<string, string>> {
        let data: Buffer;
        try {
            data = await fs.promises.readFile(filePath);
        } catch {
            return new Map();
        }

        let parsed: any;
        try {
            const parser = new XMLParser();
            parsed = parser.parse(data.toString());
        } catch {
            return new Map();
        }

        return parsePlaylistPlatformMap(parsed.LaunchBox || {});
    }

    function parsePlaylistPlatformMap(data: any): Map<string, string> {
        const parentsRaw = data.Parent
            ? Array.isArray(data.Parent)
                ? data.Parent
                : [data.Parent]
            : [];

        const map = new Map<string, string>();
        for (const parent of parentsRaw) {
            const playlistId = normalize(parent.PlaylistId);
            const platform = normalize(parent.ParentPlatformName);
            if (playlistId && platform) {
                // Fix for platforms which have incorrect encoding of the ampersand character
                map.set(playlistId, platform.replace("&amp;", "&"));
            }
        }
        return map;
    }

    function normalize(value: unknown): string {
        return typeof value === "string" ? value.trim() : "";
    }
}
