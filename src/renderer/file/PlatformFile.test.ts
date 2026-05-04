import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { updateFavoriteField } from "./PlatformFile";

function makeXml(games: { id: string; favorite: boolean }[]): string {
    const gameBlocks = games
    .map(
        (g) =>
            `  <Game>\r\n    <ID>${g.id}</ID>\r\n    <Favorite>${g.favorite}</Favorite>\r\n  </Game>`
    )
    .join("\r\n");
    return `<?xml version="1.0"?>\r\n<LaunchBox>\r\n${gameBlocks}\r\n</LaunchBox>\r\n`;
}

async function runUpdate(
    xmlContent: string,
    gameId: string,
    newValue: boolean
): Promise<string> {
    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, `platform-test-${Date.now()}.xml`);
    fs.writeFileSync(filePath, xmlContent, "utf8");
    await updateFavoriteField(filePath, gameId, newValue);
    // Give the rename a moment to settle
    await new Promise((r) => setTimeout(r, 50));
    const result = fs.readFileSync(filePath, "utf8");
    fs.unlinkSync(filePath);
    return result;
}

describe("updateFavoriteField", () => {
    it("sets Favorite to true for the target game", async () => {
        const xml = makeXml([{ id: "game-1", favorite: false }]);
        const result = await runUpdate(xml, "game-1", true);
        expect(result).toContain("<Favorite>true</Favorite>");
    });

    it("sets Favorite to false for the target game", async () => {
        const xml = makeXml([{ id: "game-1", favorite: true }]);
        const result = await runUpdate(xml, "game-1", false);
        expect(result).toContain("<Favorite>false</Favorite>");
    });

    it("does not modify other games", async () => {
        const xml = makeXml([
            { id: "game-1", favorite: false },
            { id: "game-2", favorite: false },
        ]);
        const result = await runUpdate(xml, "game-1", true);
        const lines = result.split("\r\n");
        const game2Block = lines
        .slice(lines.findIndex((l) => l.includes("game-2")))
        .join("\r\n");
        expect(game2Block).toContain("<Favorite>false</Favorite>");
    });

    it("leaves the file unchanged when gameId is not found", async () => {
        const xml = makeXml([{ id: "game-1", favorite: false }]);
        const result = await runUpdate(xml, "nonexistent", true);
        expect(result).toContain("<Favorite>false</Favorite>");
    });
});
