import { XMLParser } from "fast-xml-parser";
import * as fs from "fs";
import * as readline from "readline";

export interface MediaFolder {
    type: string;
    path: string;
    platform: string;
}

export interface PlatformsFile {
    platforms: string[];
    media: MediaFolder[];
}

/**
 * Read and parse the file asynchronously.
 * @param filePath Path of the file.
 */
export function readPlatformsFile(filePath: string): Promise<PlatformsFile> {
    const startTime = Date.now();
    console.log(`[PERF] Reading Platforms.xml file: ${filePath}`);
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (error, data) => {
            if (error) {
                reject(error);
            } else {
                console.log(`[PERF] Platforms.xml read complete (${data.length} bytes): ${Date.now() - startTime}ms`);
                let parsed: any;
                try {
                    const parseStart = Date.now();
                    const parser = new XMLParser();
                    parsed = parser.parse(data.toString());
                    console.log(`[PERF] Platforms.xml parse complete: ${Date.now() - parseStart}ms`);
                } catch {
                    parsed = {};
                }
                resolve(parsePlatformsFile(parsed.LaunchBox || {}));
            }
        });
    });
}

function parsePlatformsFile(data: any): PlatformsFile {
    const platformsRaw = data.Platform
        ? Array.isArray(data.Platform)
            ? data.Platform
            : [data.Platform]
        : [];
    const platforms = platformsRaw
    .map((platform: any) => platform.Name ?? "")
    // Fix for the Magazines which have incorrect encoding of the ampersand character
    .map((p: string) => p.replace("&amp;", "&"))
    .filter((p: string) => !!p);

    const mediaRaw = data.PlatformFolder
        ? Array.isArray(data.PlatformFolder)
            ? data.PlatformFolder
            : [data.PlatformFolder]
        : [];
    const media = mediaRaw
    .map((m: any) => {
        return {
            type: m.MediaType,
            path: m.FolderPath,
            platform: m.Platform,
        } as MediaFolder;
    })
    .filter((m: MediaFolder) => !!m.path && !!m.platform);
    return { platforms, media };
}

const enum UpdateState {
    LookingForGameElement,
    InsideGameElement,
    FoundTargetGame,
    GameUpdated,
}

/**
 * Publish a rewritten platform file once it is actually complete.
 *
 * `readline`'s "close" only means the input was exhausted - the writes it triggered are still
 * buffered. Renaming there publishes a half-written file, and the function it was called from
 * resolved before any of this happened, so callers had no way to wait for the real result.
 */
function commitRewrite(
    rl: readline.Interface,
    readStream: fs.ReadStream,
    writeStream: fs.WriteStream,
    tempFilePath: string,
    filePath: string
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let settled = false;

        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            readStream.destroy();
            writeStream.destroy();
            fs.promises.unlink(tempFilePath).catch(() => undefined);
            reject(error);
        };

        readStream.on("error", fail);
        writeStream.on("error", fail);
        rl.on("close", () => writeStream.end());

        writeStream.on("finish", () => {
            fs.rename(tempFilePath, filePath, (error) => {
                if (error) {
                    fail(error);
                } else if (!settled) {
                    settled = true;
                    resolve();
                }
            });
        });
    });
}

export const updateInstalledField = async (
    filePath: string,
    gameId: string,
    newValue: boolean
) => {
    const tempFilePath = `${filePath}.tmp`;
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(tempFilePath);
    const rl = readline.createInterface({
        input: readStream,
        output: writeStream,
        terminal: false,
    });

    let state: UpdateState = UpdateState.LookingForGameElement;
    let temporaryLineBuffer: string[] = [];

    // We want to preserve windows style new lines
    const newLineCharacters = "\r\n";

    rl.on("line", (line) => {
        switch (state) {
            case UpdateState.LookingForGameElement:
                if (line.includes("<Game>")) {
                    state = UpdateState.InsideGameElement;
                    temporaryLineBuffer = [];
                }
                writeStream.write(`${line}${newLineCharacters}`);
                break;

            case UpdateState.InsideGameElement:
                temporaryLineBuffer.push(line);
                if (line.includes("</Game>")) {
                    const targetGameFound =
                        temporaryLineBuffer.find((l) =>
                            l.includes(`<ID>${gameId}</ID>`)
                        ) !== undefined;
                    for (const tempLine of temporaryLineBuffer) {
                        const shouldUpdateLine =
                            targetGameFound && tempLine.includes("<Installed>");
                        const lineToSave = shouldUpdateLine
                            ? tempLine.replace(
                                /<Installed>.*<\/Installed>/,
                                `<Installed>${newValue}</Installed>`
                            )
                            : tempLine;
                        writeStream.write(`${lineToSave}${newLineCharacters}`);
                    }
                    state = targetGameFound
                        ? UpdateState.GameUpdated
                        : UpdateState.LookingForGameElement;
                }
                break;

            case UpdateState.GameUpdated:
                writeStream.write(`${line}${newLineCharacters}`);
                break;
        }
    });

    return commitRewrite(rl, readStream, writeStream, tempFilePath, filePath);
};

export const updateFavoriteField = async (
    filePath: string,
    gameId: string,
    newValue: boolean
) => {
    const tempFilePath = `${filePath}.tmp`;
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(tempFilePath);
    const rl = readline.createInterface({
        input: readStream,
        output: writeStream,
        terminal: false,
    });

    let state: UpdateState = UpdateState.LookingForGameElement;
    let temporaryLineBuffer: string[] = [];

    const newLineCharacters = "\r\n";

    rl.on("line", (line) => {
        switch (state) {
            case UpdateState.LookingForGameElement:
                if (line.includes("<Game>")) {
                    state = UpdateState.InsideGameElement;
                    temporaryLineBuffer = [];
                }
                writeStream.write(`${line}${newLineCharacters}`);
                break;

            case UpdateState.InsideGameElement:
                temporaryLineBuffer.push(line);
                if (line.includes("</Game>")) {
                    const targetGameFound =
                        temporaryLineBuffer.find((l) =>
                            l.includes(`<ID>${gameId}</ID>`)
                        ) !== undefined;
                    for (const tempLine of temporaryLineBuffer) {
                        const shouldUpdateLine =
                            targetGameFound && tempLine.includes("<Favorite>");
                        const lineToSave = shouldUpdateLine
                            ? tempLine.replace(
                                /<Favorite>.*<\/Favorite>/,
                                `<Favorite>${newValue}</Favorite>`
                            )
                            : tempLine;
                        writeStream.write(`${lineToSave}${newLineCharacters}`);
                    }
                    state = targetGameFound
                        ? UpdateState.GameUpdated
                        : UpdateState.LookingForGameElement;
                }
                break;

            case UpdateState.GameUpdated:
                writeStream.write(`${line}${newLineCharacters}`);
                break;
        }
    });

    return commitRewrite(rl, readStream, writeStream, tempFilePath, filePath);
};
