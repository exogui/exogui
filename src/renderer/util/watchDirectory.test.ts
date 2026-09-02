import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
    diffSnapshots,
    DirSnapshot,
    readSnapshot,
    watchDirectory,
    WatchStrategy,
} from "./watchDirectory";

jest.setTimeout(30000);

function snapshot(entries: Record<string, "file" | "dir">): DirSnapshot {
    return new Map(Object.entries(entries));
}

describe("diffSnapshots", () => {
    it("reports entries that appeared", () => {
        const { added, removed } = diffSnapshots(
            snapshot({ "Alley Cat.mp4": "file" }),
            snapshot({ "Alley Cat.mp4": "file", "Boulder Dash.mp4": "file" })
        );

        expect(added).toEqual([{ name: "Boulder Dash.mp4", kind: "file" }]);
        expect(removed).toEqual([]);
    });

    it("reports entries that disappeared", () => {
        const { added, removed } = diffSnapshots(
            snapshot({ "Alley Cat": "dir", "Boulder Dash": "dir" }),
            snapshot({ "Alley Cat": "dir" })
        );

        expect(added).toEqual([]);
        expect(removed).toEqual([{ name: "Boulder Dash", kind: "dir" }]);
    });

    it("classifies added entries as file or directory", () => {
        const { added } = diffSnapshots(
            snapshot({}),
            snapshot({ "Alley Cat": "dir", "Alley Cat.mp4": "file" })
        );

        expect(added).toEqual([
            { name: "Alley Cat", kind: "dir" },
            { name: "Alley Cat.mp4", kind: "file" },
        ]);
    });

    it("classifies removed entries from the previous snapshot", () => {
        // A removed entry can no longer be stat'd, so its kind has to come from the snapshot.
        const { removed } = diffSnapshots(
            snapshot({ "Alley Cat": "dir", "Alley Cat.mp4": "file" }),
            snapshot({})
        );

        expect(removed).toEqual([
            { name: "Alley Cat", kind: "dir" },
            { name: "Alley Cat.mp4", kind: "file" },
        ]);
    });

    it("reports nothing when the listing is unchanged", () => {
        const unchanged = snapshot({ "Alley Cat": "dir", "Alley Cat.mp4": "file" });
        const { added, removed } = diffSnapshots(unchanged, snapshot({
            "Alley Cat": "dir",
            "Alley Cat.mp4": "file",
        }));

        expect(added).toEqual([]);
        expect(removed).toEqual([]);
    });
});

describe("readSnapshot", () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "exogui-snapshot-"));
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("records the kind of every entry", () => {
        fs.mkdirSync(path.join(dir, "Alley Cat"));
        fs.writeFileSync(path.join(dir, "Alley Cat.mp4"), "x");

        expect(readSnapshot(dir)).toEqual(
            snapshot({ "Alley Cat": "dir", "Alley Cat.mp4": "file" })
        );
    });

    it("returns an empty snapshot for a missing directory", () => {
        expect(readSnapshot(path.join(dir, "nope"))).toEqual(new Map());
    });
});

describe.each<[WatchStrategy]>([["native"], ["poll"]])(
    "watchDirectory (%s)",
    (strategy) => {
        let dir: string;
        let watchers: { close: () => void }[];
        let addedFiles: string[];
        let addedDirs: string[];
        let removedDirs: string[];

        const options = { strategy, debounceMs: 20, pollIntervalMs: 100 };

        function start(target = dir, extra: Record<string, unknown> = {}) {
            const watcher = watchDirectory(
                target,
                {
                    onAddFile: (p) => addedFiles.push(path.basename(p)),
                    onAddDir: (p) => addedDirs.push(path.basename(p)),
                    onRemoveDir: (p) => removedDirs.push(path.basename(p)),
                },
                { ...options, ...extra }
            );
            watchers.push(watcher);
            return watcher;
        }

        async function waitFor(
            predicate: () => boolean,
            timeoutMs = 10000
        ): Promise<void> {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                if (predicate()) return;
                await new Promise((r) => setTimeout(r, 25));
            }
            throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
        }

        /** Gives the watcher a chance to prove it did NOT fire. */
        function settle(ms = 600): Promise<void> {
            return new Promise((r) => setTimeout(r, ms));
        }

        beforeEach(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), "exogui-watchdir-"));
            watchers = [];
            addedFiles = [];
            addedDirs = [];
            removedDirs = [];
        });

        afterEach(() => {
            watchers.forEach((w) => w.close());
            fs.rmSync(dir, { recursive: true, force: true });
        });

        it("reports a new file", async () => {
            start();
            await settle(200);

            fs.writeFileSync(path.join(dir, "Alley Cat.mp4"), "x");

            await waitFor(() => addedFiles.includes("Alley Cat.mp4"));
            expect(addedDirs).toEqual([]);
        });

        it("reports a new directory", async () => {
            start();
            await settle(200);

            fs.mkdirSync(path.join(dir, "Alley Cat"));

            await waitFor(() => addedDirs.includes("Alley Cat"));
            expect(addedFiles).toEqual([]);
        });

        it("reports a removed directory", async () => {
            fs.mkdirSync(path.join(dir, "Alley Cat"));
            start();
            await settle(200);

            fs.rmSync(path.join(dir, "Alley Cat"), { recursive: true });

            await waitFor(() => removedDirs.includes("Alley Cat"));
        });

        it("never reports entries that existed when it started", async () => {
            fs.mkdirSync(path.join(dir, "Alley Cat"));
            fs.writeFileSync(path.join(dir, "Boulder Dash.mp4"), "x");

            start();
            await settle();

            expect(addedFiles).toEqual([]);
            expect(addedDirs).toEqual([]);
            expect(removedDirs).toEqual([]);
        });

        it("does not descend into subdirectories", async () => {
            const gameDir = path.join(dir, "Alley Cat");
            fs.mkdirSync(gameDir);
            start();
            await settle(200);

            fs.writeFileSync(path.join(gameDir, "dosbox.conf"), "x");

            await settle();
            expect(addedFiles).toEqual([]);
            expect(addedDirs).toEqual([]);
        });

        it("reports every entry of a burst exactly once", async () => {
            start();
            await settle(200);

            for (let i = 0; i < 50; i++) {
                fs.writeFileSync(path.join(dir, `Game ${i}.mp4`), "x");
            }

            await waitFor(() => addedFiles.length >= 50);
            await settle();
            expect(addedFiles).toHaveLength(50);
            expect(new Set(addedFiles).size).toBe(50);
        });

        /**
         * Platforms differ in how noisy the change signal is - macOS FSEvents reports subtree
         * activity, Windows batches differently to inotify. Emissions come from re-reading the
         * directory rather than from the event payload, so a signal that fires without the listing
         * changing must produce nothing.
         */
        it("emits nothing when the signal fires but the listing is unchanged", async () => {
            fs.mkdirSync(path.join(dir, "Alley Cat"));
            start();
            await settle(200);

            const past = new Date(Date.now() - 60000);
            fs.utimesSync(dir, past, past);

            await settle();
            expect(addedFiles).toEqual([]);
            expect(addedDirs).toEqual([]);
            expect(removedDirs).toEqual([]);
        });

        it("skips entries matched by the ignore predicate", async () => {
            start(dir, { ignore: (name: string) => /^DOWNLOAD$/i.test(name) });
            await settle(200);

            fs.mkdirSync(path.join(dir, "DOWNLOAD"));
            fs.mkdirSync(path.join(dir, "Alley Cat"));

            await waitFor(() => addedDirs.includes("Alley Cat"));
            await settle();
            expect(addedDirs).not.toContain("DOWNLOAD");
        });

        it("stops reporting after close", async () => {
            const watcher = start();
            await settle(200);
            watcher.close();

            fs.writeFileSync(path.join(dir, "Alley Cat.mp4"), "x");

            await settle();
            expect(addedFiles).toEqual([]);
        });

        it("does not throw for a missing directory", async () => {
            const missing = path.join(dir, "Videos", "MS-DOS");

            expect(() => start(missing)).not.toThrow();

            fs.mkdirSync(missing, { recursive: true });
            fs.writeFileSync(path.join(missing, "Alley Cat.mp4"), "x");

            await settle();
            expect(addedFiles).toEqual([]);
        });
    }
);
