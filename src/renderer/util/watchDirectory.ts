import * as fs from "fs";
import * as path from "path";

export type DirEntryKind = "file" | "dir";
export type DirSnapshot = Map<string, DirEntryKind>;
export type WatchStrategy = "native" | "poll";

export interface DirEntry {
    name: string;
    kind: DirEntryKind;
}

export interface DirectoryWatcherHandlers {
    onAddFile?: (absolutePath: string) => void;
    onAddDir?: (absolutePath: string) => void;
    onRemoveDir?: (absolutePath: string) => void;
}

export interface DirectoryWatcherOptions {
    debounceMs?: number;
    pollIntervalMs?: number;
    strategy?: WatchStrategy;
    ignore?: (name: string) => boolean;
}

export interface DirectoryWatcher {
    close(): void;
}

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_POLL_INTERVAL_MS = 1000;

export function readSnapshot(dir: string): DirSnapshot {
    const snapshot: DirSnapshot = new Map();
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return snapshot;
    }
    for (const entry of entries) {
        snapshot.set(entry.name, entry.isDirectory() ? "dir" : "file");
    }
    return snapshot;
}

export function diffSnapshots(
    previous: DirSnapshot,
    current: DirSnapshot
): { added: DirEntry[]; removed: DirEntry[] } {
    const added: DirEntry[] = [];
    const removed: DirEntry[] = [];

    for (const [name, kind] of current) {
        if (!previous.has(name)) added.push({ name, kind });
    }
    for (const [name, kind] of previous) {
        if (!current.has(name)) removed.push({ name, kind });
    }

    return { added, removed };
}

/**
 * Watches a single directory for entries appearing and disappearing, using one inotify watch on the
 * directory rather than one per file. Only direct children are reported, and only the events the
 * launcher acts on: files added, directories added, directories removed.
 */
export function watchDirectory(
    dir: string,
    handlers: DirectoryWatcherHandlers,
    options: DirectoryWatcherOptions = {}
): DirectoryWatcher {
    const {
        debounceMs = DEFAULT_DEBOUNCE_MS,
        pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
        strategy = "native",
        ignore,
    } = options;

    const read = (): DirSnapshot => {
        const snapshot = readSnapshot(dir);
        if (ignore) {
            for (const name of snapshot.keys()) {
                if (ignore(name)) snapshot.delete(name);
            }
        }
        return snapshot;
    };

    if (!fs.existsSync(dir)) {
        console.log(`Not watching ${dir}: directory does not exist.`);
        return { close: () => undefined };
    }

    let snapshot = read();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const rescan = () => {
        timer = undefined;
        if (closed) return;

        const current = read();
        const { added, removed } = diffSnapshots(snapshot, current);
        snapshot = current;

        for (const entry of added) {
            const absolutePath = path.join(dir, entry.name);
            if (entry.kind === "dir") handlers.onAddDir?.(absolutePath);
            else handlers.onAddFile?.(absolutePath);
        }
        for (const entry of removed) {
            if (entry.kind === "dir") {
                handlers.onRemoveDir?.(path.join(dir, entry.name));
            }
        }
    };

    const schedule = () => {
        if (closed || timer) return;
        timer = setTimeout(rescan, debounceMs);
    };

    if (strategy === "poll") {
        const listener = () => schedule();
        fs.watchFile(dir, { interval: pollIntervalMs }, listener);
        return {
            close: () => {
                closed = true;
                if (timer) clearTimeout(timer);
                fs.unwatchFile(dir, listener);
            },
        };
    }

    const watcher = fs.watch(dir, () => schedule());
    watcher.on("error", (error) => console.log(`Watcher error: ${error}`));

    return {
        close: () => {
            closed = true;
            if (timer) clearTimeout(timer);
            watcher.close();
        },
    };
}
