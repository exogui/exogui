import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ParentsFile } from "./ParentsFile";

async function writeTempXml(content: string): Promise<string> {
    const filePath = path.join(
        os.tmpdir(),
        `parents-test-${Date.now()}-${Math.random()}.xml`
    );
    await fs.promises.writeFile(filePath, content, "utf8");
    return filePath;
}

describe("ParentsFile.readPlaylistPlatformMap", () => {
    it("maps playlist ids to their parent platform name", async () => {
        const filePath = await writeTempXml(`<?xml version="1.0"?>
<LaunchBox>
  <Parent>
    <PlaylistId>id-1</PlaylistId>
    <ParentPlatformName>MS-DOS</ParentPlatformName>
  </Parent>
  <Parent>
    <PlaylistId>id-2</PlaylistId>
    <ParentPlatformName>DREAMM</ParentPlatformName>
  </Parent>
</LaunchBox>`);
        const map = await ParentsFile.readPlaylistPlatformMap(filePath);
        await fs.promises.unlink(filePath);

        expect(map.get("id-1")).toBe("MS-DOS");
        expect(map.get("id-2")).toBe("DREAMM");
        expect(map.size).toBe(2);
    });

    it("ignores entries without both a playlist id and a parent platform", async () => {
        const filePath = await writeTempXml(`<?xml version="1.0"?>
<LaunchBox>
  <Parent>
    <PlatformName>MS-DOS</PlatformName>
    <ParentPlatformCategoryName>Computers</ParentPlatformCategoryName>
  </Parent>
  <Parent>
    <PlaylistId />
    <ParentPlatformName>MS-DOS</ParentPlatformName>
  </Parent>
  <Parent>
    <PlaylistId>id-1</PlaylistId>
    <ParentPlatformName />
  </Parent>
  <Parent>
    <PlaylistId>id-2</PlaylistId>
    <ParentPlatformName>MS-DOS</ParentPlatformName>
  </Parent>
</LaunchBox>`);
        const map = await ParentsFile.readPlaylistPlatformMap(filePath);
        await fs.promises.unlink(filePath);

        expect(map.size).toBe(1);
        expect(map.get("id-2")).toBe("MS-DOS");
    });

    it("fixes the encoded ampersand in platform names", async () => {
        const filePath = await writeTempXml(`<?xml version="1.0"?>
<LaunchBox>
  <Parent>
    <PlaylistId>id-1</PlaylistId>
    <ParentPlatformName>Magazines &amp;amp; Newsletters</ParentPlatformName>
  </Parent>
</LaunchBox>`);
        const map = await ParentsFile.readPlaylistPlatformMap(filePath);
        await fs.promises.unlink(filePath);

        expect(map.get("id-1")).toBe("Magazines & Newsletters");
    });

    it("returns an empty map when the file does not exist", async () => {
        const map = await ParentsFile.readPlaylistPlatformMap(
            path.join(os.tmpdir(), "does-not-exist-parents.xml")
        );
        expect(map.size).toBe(0);
    });
});
