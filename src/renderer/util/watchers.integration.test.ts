jest.mock("@electron/remote", () => ({ shell: { openPath: jest.fn() } }));
jest.mock("@renderer/redux/store", () => ({
    __esModule: true,
    default: { getState: jest.fn(), dispatch: jest.fn() },
}));
jest.mock("@renderer/redux/gamesSlice", () => ({
    updateGame: jest.fn((payload) => ({ type: "games/updateGame", payload })),
}));
jest.mock("@renderer/file/PlatformFile", () => ({
    updateInstalledField: jest.fn(),
    updateFavoriteField: jest.fn(),
}));

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import store from "@renderer/redux/store";
import { updateGame } from "@renderer/redux/gamesSlice";
import { updateInstalledField } from "@renderer/file/PlatformFile";
import { IGameCollection, IGameInfo } from "@shared/game/interfaces";
import { createGamesWatcher } from "./games";
import { createMusicWatcher, createVideosWatcher } from "./media";
import { createManualsWatcher } from "./addApps";

jest.setTimeout(30000);

const PLATFORM = "MS-DOS";
/** Time given to the watcher to bind before the test mutates the directory. */
const SETTLE_MS = 800;

type Closable = { close: () => unknown };

let root: string;
let openWatchers: Closable[];

/** Polls until the predicate holds, so tests never depend on a fixed event latency. */
async function waitFor(
    predicate: () => boolean,
    timeoutMs = 12000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

/** Gives the watcher a chance to prove it did NOT fire. */
function settle(ms = SETTLE_MS): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function track<T extends Closable | undefined>(watcher: T): T {
    if (watcher) openWatchers.push(watcher);
    return watcher;
}

function makeGame(title: string): IGameInfo {
    return {
        id: `id-${title}`,
        title,
        rootFolder: `eXo/eXoDOS/!dos/${title}`,
        applicationPath: `eXo\\eXoDOS\\!dos\\${title}\\${title}.bat`,
        library: PLATFORM,
        platform: PLATFORM,
        installed: false,
        manualPath: "",
        musicPath: "",
        media: { video: "" },
    } as unknown as IGameInfo;
}

const ALLEY_CAT = makeGame("Alley Cat");
const GAMES = [ALLEY_CAT, makeGame("Boulder Dash")];

/** The payloads passed to updateGame, in order. */
function updatedGames(): IGameInfo[] {
    return (updateGame as unknown as jest.Mock).mock.calls.map(
        (call) => call[0].game
    );
}

function lastUpdateFor(title: string): IGameInfo | undefined {
    return updatedGames()
    .filter((g) => g.title === title)
    .pop();
}

beforeEach(() => {
    jest.clearAllMocks();
    openWatchers = [];
    root = fs.mkdtempSync(path.join(os.tmpdir(), "exogui-watchers-"));

    for (const dir of [
        path.join(root, "eXo", "eXoDOS"),
        path.join(root, "Videos", PLATFORM),
        path.join(root, "Manuals", PLATFORM),
        path.join(root, "Music", PLATFORM),
        path.join(root, "Data", "Platforms"),
    ]) {
        fs.mkdirSync(dir, { recursive: true });
    }

    (window as any).External = {
        config: {
            fullExodosPath: root,
            data: { platformFolderPath: "Data/Platforms" },
        },
    };

    (store.getState as jest.Mock).mockReturnValue({
        gamesState: { games: GAMES },
    });
});

afterEach(async () => {
    await Promise.all(openWatchers.map((w) => w.close()));
    openWatchers = [];
    fs.rmSync(root, { recursive: true, force: true });
});

describe("createVideosWatcher", () => {
    it("updates the matching game when a video appears", async () => {
        track(createVideosWatcher(PLATFORM));
        await settle();

        fs.writeFileSync(path.join(root, "Videos", PLATFORM, "Alley Cat.mp4"), "x");

        await waitFor(() => !!lastUpdateFor("Alley Cat"));
        expect(lastUpdateFor("Alley Cat")?.media.video).toBe(
            `Videos/${PLATFORM}/Alley Cat.mp4`
        );
    });

    it("does not filter by extension", async () => {
        track(createVideosWatcher(PLATFORM));
        await settle();

        fs.writeFileSync(path.join(root, "Videos", PLATFORM, "Alley Cat.webm"), "x");

        await waitFor(() => !!lastUpdateFor("Alley Cat"));
        expect(lastUpdateFor("Alley Cat")?.media.video).toBe(
            `Videos/${PLATFORM}/Alley Cat.webm`
        );
    });

    it("ignores a file whose title matches no game", async () => {
        track(createVideosWatcher(PLATFORM));
        await settle();

        fs.writeFileSync(path.join(root, "Videos", PLATFORM, "Not A Game.mp4"), "x");

        await settle(4000);
        expect(updateGame).not.toHaveBeenCalled();
    });
});

describe("createMusicWatcher", () => {
    it("updates the matching game when music appears", async () => {
        track(createMusicWatcher(PLATFORM));
        await settle();

        fs.writeFileSync(path.join(root, "Music", PLATFORM, "Alley Cat.mp3"), "x");

        await waitFor(() => !!lastUpdateFor("Alley Cat"));
        expect(lastUpdateFor("Alley Cat")?.musicPath).toBe(
            `Music/${PLATFORM}/Alley Cat.mp3`
        );
    });

    it("ignores files with a non-music extension", async () => {
        track(createMusicWatcher(PLATFORM));
        await settle();

        fs.writeFileSync(path.join(root, "Music", PLATFORM, "Alley Cat.txt"), "x");

        await settle(2000);
        expect(updateGame).not.toHaveBeenCalled();
    });
});

describe("createManualsWatcher", () => {
    it("updates the matching game when a manual appears", async () => {
        track(createManualsWatcher(PLATFORM));
        await settle();

        fs.writeFileSync(path.join(root, "Manuals", PLATFORM, "Alley Cat.pdf"), "x");

        await waitFor(() => !!lastUpdateFor("Alley Cat"));
        expect(lastUpdateFor("Alley Cat")?.manualPath).toBe(
            `Manuals/${PLATFORM}/Alley Cat.pdf`
        );
    });
});

/**
 * The point of watching directories rather than every file inside them: a media folder holds one
 * file per game, so a per-file watch makes inotify usage scale with the size of the collection.
 */
describe("inotify cost", () => {
    const itOnLinux = process.platform === "linux" ? it : it.skip;

    function inotifyWatchCount(): number {
        const fdDir = `/proc/${process.pid}/fd`;
        let total = 0;
        for (const fd of fs.readdirSync(fdDir)) {
            let link: string;
            try {
                link = fs.readlinkSync(path.join(fdDir, fd));
            } catch {
                continue;
            }
            if (!link.includes("inotify")) continue;
            try {
                const info = fs.readFileSync(
                    `/proc/${process.pid}/fdinfo/${fd}`,
                    "utf8"
                );
                total += (info.match(/^inotify wd:/gm) ?? []).length;
            } catch {
                continue;
            }
        }
        return total;
    }

    /** Waits until the watcher has finished registering, i.e. the count stops moving. */
    async function settledWatchCount(): Promise<number> {
        let previous = -1;
        for (let i = 0; i < 40; i++) {
            await new Promise((r) => setTimeout(r, 250));
            const current = inotifyWatchCount();
            if (current === previous) return current;
            previous = current;
        }
        return previous;
    }

    itOnLinux(
        "stays flat as the number of files in the watched folder grows",
        async () => {
            const videosDir = path.join(root, "Videos", PLATFORM);
            for (let i = 0; i < 500; i++) {
                fs.writeFileSync(path.join(videosDir, `Filler ${i}.mp4`), "x");
            }

            const before = inotifyWatchCount();
            track(createVideosWatcher(PLATFORM));
            const after = await settledWatchCount();

            expect(after - before).toBeLessThanOrEqual(2);
        }
    );
});

describe("createGamesWatcher", () => {
    const collection = { games: GAMES } as unknown as IGameCollection;

    it("marks a game installed when its folder appears", async () => {
        track(createGamesWatcher(collection));
        await settle();

        fs.mkdirSync(path.join(root, "eXo", "eXoDOS", "Alley Cat"));

        await waitFor(() => !!lastUpdateFor("Alley Cat"));
        expect(lastUpdateFor("Alley Cat")?.installed).toBe(true);
        expect(updateInstalledField).toHaveBeenCalledWith(
            path.join(root, "Data/Platforms", `${PLATFORM}.xml`),
            ALLEY_CAT.id,
            true
        );
    });

    it("marks a game not installed when its folder is removed", async () => {
        const gameDir = path.join(root, "eXo", "eXoDOS", "Alley Cat");
        fs.mkdirSync(gameDir);

        track(createGamesWatcher(collection));
        await settle();

        fs.rmSync(gameDir, { recursive: true });

        await waitFor(() => !!lastUpdateFor("Alley Cat"));
        expect(lastUpdateFor("Alley Cat")?.installed).toBe(false);
        expect(updateInstalledField).toHaveBeenCalledWith(
            path.join(root, "Data/Platforms", `${PLATFORM}.xml`),
            ALLEY_CAT.id,
            false
        );
    });

    it("ignores the DOWNLOAD folder", async () => {
        track(createGamesWatcher(collection));
        await settle();

        fs.mkdirSync(path.join(root, "eXo", "eXoDOS", "DOWNLOAD"));

        await settle(2000);
        expect(updateGame).not.toHaveBeenCalled();
    });

    it("does not react to files created inside a game folder", async () => {
        const gameDir = path.join(root, "eXo", "eXoDOS", "Alley Cat");
        fs.mkdirSync(gameDir);

        track(createGamesWatcher(collection));
        await settle();

        fs.writeFileSync(path.join(gameDir, "dosbox.conf"), "x");

        await settle(2000);
        expect(updateGame).not.toHaveBeenCalled();
    });
});
