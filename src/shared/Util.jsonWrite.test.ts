import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { writeJsonDataFile } from "./Util";

describe("writeJsonDataFile", () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "exogui-json-write-"));
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("writes a file that parses back to the given data", async () => {
        const filePath = path.join(dir, "preferences.json");

        await writeJsonDataFile(filePath, { browsePageGameScale: 0.5 });

        expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toEqual({
            browsePageGameScale: 0.5,
        });
    });

    it("leaves a parseable file when writes overlap", async () => {
        const filePath = path.join(dir, "preferences.json");
        // Unserialized writes each truncate the file and write from offset zero, so a long
        // write landing after a short one leaves its tail past the short one's closing brace.
        const long = { pad: "x".repeat(8000) };
        const short = { pad: "y" };

        await Promise.all([
            writeJsonDataFile(filePath, long),
            writeJsonDataFile(filePath, short),
            writeJsonDataFile(filePath, long),
            writeJsonDataFile(filePath, short),
        ]);

        const content = fs.readFileSync(filePath, "utf8");
        expect(() => JSON.parse(content)).not.toThrow();
        expect(JSON.parse(content)).toEqual(short);
    });

    it("cleans up after itself", async () => {
        const filePath = path.join(dir, "config.json");

        await Promise.all([
            writeJsonDataFile(filePath, { a: 1 }),
            writeJsonDataFile(filePath, { a: 2 }),
        ]);

        expect(fs.readdirSync(dir)).toEqual(["config.json"]);
    });
});
