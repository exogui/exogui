import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PlaylistFile } from "./PlaylistFile";

async function writeTempXml(content: string): Promise<string> {
    const filePath = path.join(
        os.tmpdir(),
        `playlist-test-${Date.now()}-${Math.random()}.xml`
    );
    await fs.promises.writeFile(filePath, content, "utf8");
    return filePath;
}

describe("PlaylistFile.readFile", () => {
    it("extracts the playlist id", async () => {
        const filePath = await writeTempXml(`<?xml version="1.0"?>
<LaunchBox>
  <Playlist>
    <PlaylistId>abc-123</PlaylistId>
    <Name>My Playlist</Name>
    <Notes>Some notes</Notes>
  </Playlist>
</LaunchBox>`);
        const playlist = await PlaylistFile.readFile(filePath);
        await fs.promises.unlink(filePath);

        expect(playlist.playlistId).toBe("abc-123");
        expect(playlist.title).toBe("My Playlist");
    });

    it("defaults the playlist id to an empty string when missing", async () => {
        const filePath = await writeTempXml(`<?xml version="1.0"?>
<LaunchBox>
  <Playlist>
    <Name>No Id Playlist</Name>
  </Playlist>
</LaunchBox>`);
        const playlist = await PlaylistFile.readFile(filePath);
        await fs.promises.unlink(filePath);

        expect(playlist.playlistId).toBe("");
    });
});
