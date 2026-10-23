import { ChildProcess, fork } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
    ThumbnailJob,
    ThumbnailMessage,
    ThumbnailTask,
} from "./thumbnailTypes";

/** Recycle the worker after this many jobs, to bound retained native memory. */
const MAX_JOBS_PER_WORKER = 100;

/** Recycle early if the worker reports more resident memory than this. */
const MAX_WORKER_RSS_BYTES = 400 * 1024 * 1024;

/** A 200 megapixel scan off a slow USB disk is the worst realistic case. */
const JOB_TIMEOUT_MS = 60_000;

/** Drop the worker once browsing stops, so an idle session holds nothing. */
const IDLE_TIMEOUT_MS = 60_000;

/** Grace period between asking a worker to exit and killing it. */
const KILL_GRACE_MS = 2_000;

/** Consecutive workers that die before reporting ready before we stop trying. */
const MAX_BOOT_FAILURES = 3;

/** How long to serve originals before attempting to start a worker again. */
const BOOT_COOLDOWN_MS = 30_000;

type PendingJob = {
    task: ThumbnailTask;
    resolve: () => void;
    reject: (error: Error) => void;
};

/** Identity of a poisoned source, so a repaired or replaced file gets another chance. */
type PoisonEntry = { size: number; mtimeMs: number };

export type ThumbnailPoolOptions = {
    spawn?: () => ChildProcess;
    maxJobsPerWorker?: number;
    maxWorkerRssBytes?: number;
    jobTimeoutMs?: number;
    idleTimeoutMs?: number;
    maxBootFailures?: number;
    bootCooldownMs?: number;
    poisonFilePath?: string;
};

/**
 * Runs image work in a child process, one job at a time, and replaces that child periodically.
 *
 * libvips retains native memory that it never returns - a full cold sweep of one eXoDOS
 * collection took the back process past 14 GB - and no in-process knob releases it
 * (`sharp.cache(false)`, `sharp.concurrency(1)` and `MALLOC_ARENA_MAX` were all measured to do
 * nothing). Process exit is the only thing that does. Isolating the work also means a segfault
 * in libvips costs a worker instead of the launcher.
 */
export class ThumbnailPool {
    private worker: ChildProcess | null = null;
    private queue: PendingJob[] = [];
    private active: PendingJob | null = null;
    private activeId = 0;
    private jobTimer: NodeJS.Timeout | null = null;
    private idleTimer: NodeJS.Timeout | null = null;
    private jobsThisWorker = 0;
    private nextId = 1;
    private discardingWorker = false;
    private closed = false;

    /** Whether the current worker got far enough to load sharp. */
    private workerReady = false;

    private bootFailures = 0;
    private cooldownUntil = 0;

    /** Sources that took a worker down with them; never retried while they stay unchanged. */
    private readonly poisoned = new Map<string, PoisonEntry | null>();

    private poisonWrites: Promise<void> = Promise.resolve();

    private readonly spawn: () => ChildProcess;
    private readonly maxJobsPerWorker: number;
    private readonly maxWorkerRssBytes: number;
    private readonly jobTimeoutMs: number;
    private readonly idleTimeoutMs: number;
    private readonly maxBootFailures: number;
    private readonly bootCooldownMs: number;
    private readonly poisonFilePath?: string;

    constructor(options: ThumbnailPoolOptions = {}) {
        this.spawn =
            options.spawn ?? (() => fork(path.join(__dirname, "thumbnailWorker.js")));
        this.maxJobsPerWorker = options.maxJobsPerWorker ?? MAX_JOBS_PER_WORKER;
        this.maxWorkerRssBytes = options.maxWorkerRssBytes ?? MAX_WORKER_RSS_BYTES;
        this.jobTimeoutMs = options.jobTimeoutMs ?? JOB_TIMEOUT_MS;
        this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
        this.maxBootFailures = options.maxBootFailures ?? MAX_BOOT_FAILURES;
        this.bootCooldownMs = options.bootCooldownMs ?? BOOT_COOLDOWN_MS;
        this.poisonFilePath = options.poisonFilePath;
        this.loadPoisonMemo();
    }

    run(task: ThumbnailTask): Promise<void> {
        if (this.closed) {
            return Promise.reject(new Error("Thumbnail pool is closed"));
        }
        if (this.poisoned.has(task.src)) {
            return this.runUnlessStillPoisoned(task);
        }
        return this.enqueue(task);
    }

    close(): void {
        this.closed = true;
        this.clearIdleTimer();
        const queued = this.queue.splice(0);
        for (const pending of queued) {
            pending.reject(new Error("Thumbnail pool is closed"));
        }
        this.discardWorker();
    }

    private enqueue(task: ThumbnailTask): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.pump();
        });
    }

    private async runUnlessStillPoisoned(task: ThumbnailTask): Promise<void> {
        const entry = this.poisoned.get(task.src);
        if (entry && !(await this.matchesPoisonEntry(task.src, entry))) {
            this.poisoned.delete(task.src);
            this.savePoisonMemo();
            return this.enqueue(task);
        }
        throw new Error(
            `Skipping "${task.src}": it crashed the image worker previously`
        );
    }

    private async matchesPoisonEntry(
        src: string,
        entry: PoisonEntry
    ): Promise<boolean> {
        try {
            const stat = await fs.promises.stat(src);
            return stat.size === entry.size && stat.mtimeMs === entry.mtimeMs;
        } catch {
            return true;
        }
    }

    private pump(): void {
        if (this.closed || this.active) {
            return;
        }
        for (let next = this.queue.shift(); next; next = this.queue.shift()) {
            const worker = this.ensureWorker();
            if (!worker) {
                next.reject(new Error(this.startFailureMessage()));
                continue;
            }
            this.clearIdleTimer();
            this.dispatch(worker, next);
            return;
        }
        this.armIdleTimer();
    }

    private dispatch(worker: ChildProcess, pending: PendingJob): void {
        this.active = pending;
        this.activeId = this.nextId++;
        const job: ThumbnailJob = { ...pending.task, id: this.activeId };

        this.jobTimer = setTimeout(() => this.onJobTimeout(), this.jobTimeoutMs);
        this.jobTimer.unref();

        try {
            worker.send(job);
        } catch (error) {
            this.finishActive(
                new Error(`Failed to hand the job to the image worker: ${error}`)
            );
            this.discardWorker();
            this.pump();
        }
    }

    private startFailureMessage(): string {
        return this.coolingDown()
            ? "The image worker keeps failing to start; serving original images instead"
            : "Could not start the image worker";
    }

    private coolingDown(): boolean {
        return this.cooldownUntil > Date.now();
    }

    private ensureWorker(): ChildProcess | null {
        if (this.worker) {
            return this.worker;
        }
        if (this.coolingDown()) {
            return null;
        }
        if (this.cooldownUntil > 0) {
            this.cooldownUntil = 0;
            this.bootFailures = 0;
        }
        try {
            const worker = this.spawn();
            this.worker = worker;
            this.jobsThisWorker = 0;
            this.discardingWorker = false;
            this.workerReady = false;
            worker.on("message", (message) =>
                this.onMessage(message as ThumbnailMessage)
            );
            // A worker that fails to spawn emits "error" and "close" but never "exit", so
            // listen for both or a doomed job hangs until its timeout. The guard in
            // onWorkerGone makes the second of the two a no-op.
            worker.on("exit", (code, signal) => this.onWorkerGone(worker, code, signal));
            worker.on("close", (code, signal) => this.onWorkerGone(worker, code, signal));
            worker.on("error", (error) => console.warn(`Image worker error: ${error}`));
            return worker;
        } catch (error) {
            console.warn(`Failed to start the image worker: ${error}`);
            this.worker = null;
            this.noteBootFailure();
            return null;
        }
    }

    private onMessage(message: ThumbnailMessage): void {
        if ("ready" in message) {
            this.workerReady = true;
            this.bootFailures = 0;
            this.cooldownUntil = 0;
            return;
        }
        if (!this.active || message.id !== this.activeId) {
            return;
        }
        this.jobsThisWorker++;
        this.finishActive(message.ok ? undefined : new Error(message.error));

        if (
            this.jobsThisWorker >= this.maxJobsPerWorker ||
            message.rss > this.maxWorkerRssBytes
        ) {
            this.discardWorker();
        }
        this.pump();
    }

    private onWorkerGone(
        worker: ChildProcess,
        code: number | null,
        signal: NodeJS.Signals | null
    ): void {
        if (worker !== this.worker) {
            return;
        }
        this.worker = null;

        if (this.active && !this.discardingWorker) {
            this.failActiveForDeadWorker(code, signal);
        } else if (!this.discardingWorker) {
            if (!this.workerReady) {
                this.noteBootFailure();
            }
            console.warn(
                `Image worker exited unexpectedly (code=${code}, signal=${signal}).`
            );
        }

        this.discardingWorker = false;
        this.pump();
    }

    /**
     * A worker that had loaded sharp was touching exactly one source when it died, so name
     * that source and refuse it from now on. One that died before reporting ready never got
     * to the image at all - blaming it would poison a healthy file for every image in turn.
     */
    private failActiveForDeadWorker(
        code: number | null,
        signal: NodeJS.Signals | null
    ): void {
        const src = this.active?.task.src ?? "";
        if (!this.workerReady) {
            this.noteBootFailure();
            console.error(
                `Image worker failed to start (code=${code}, signal=${signal}), so "${src}" ` +
                    "was not processed. The original image will be served instead."
            );
            this.finishActive(new Error("The image worker could not start"));
            return;
        }
        this.poison(src);
        console.error(
            `Image worker died (code=${code}, signal=${signal}) while processing "${src}". ` +
                "That file will be skipped from now on."
        );
        this.finishActive(new Error(`Image worker died while processing "${src}"`));
    }

    private noteBootFailure(): void {
        this.bootFailures++;
        if (this.bootFailures < this.maxBootFailures) {
            return;
        }
        this.cooldownUntil = Date.now() + this.bootCooldownMs;
        console.error(
            `The image worker failed to start ${this.bootFailures} times in a row. Pausing ` +
                `thumbnail generation for ${Math.round(this.bootCooldownMs / 1000)}s and ` +
                "serving original images instead."
        );
    }

    private onJobTimeout(): void {
        const src = this.active?.task.src;
        if (src && this.workerReady) {
            this.poison(src);
            console.error(
                `Image worker timed out after ${this.jobTimeoutMs}ms on "${src}". ` +
                    "That file will be skipped from now on."
            );
        } else {
            console.error(
                `Image worker went unresponsive before it was ready; "${src}" was not processed.`
            );
        }
        this.finishActive(new Error(`Timed out generating an image for "${src}"`));
        this.discardWorker();
        this.pump();
    }

    private finishActive(error?: Error): void {
        const pending = this.active;
        this.active = null;
        if (this.jobTimer) {
            clearTimeout(this.jobTimer);
            this.jobTimer = null;
        }
        if (!pending) {
            return;
        }
        if (error) {
            pending.reject(error);
        } else {
            pending.resolve();
        }
    }

    private discardWorker(): void {
        const worker = this.worker;
        if (!worker) {
            return;
        }
        this.worker = null;
        this.discardingWorker = true;

        try {
            worker.disconnect();
        } catch {
            /* already gone */
        }
        const killTimer = setTimeout(() => {
            if (!worker.killed) {
                worker.kill("SIGKILL");
            }
        }, KILL_GRACE_MS);
        killTimer.unref();
        worker.once("exit", () => clearTimeout(killTimer));
    }

    private armIdleTimer(): void {
        if (this.idleTimer || !this.worker) {
            return;
        }
        this.idleTimer = setTimeout(() => {
            this.idleTimer = null;
            if (!this.active && this.queue.length === 0) {
                this.discardWorker();
            }
        }, this.idleTimeoutMs);
        this.idleTimer.unref();
    }

    private clearIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    private poison(src: string): void {
        this.poisoned.set(src, null);
        void this.fingerprintPoison(src);
    }

    /**
     * Records the size and mtime of a source we just refused, so the memo can survive a
     * restart without condemning a file the user later replaces with a good copy.
     */
    private async fingerprintPoison(src: string): Promise<void> {
        try {
            const stat = await fs.promises.stat(src);
            if (this.poisoned.get(src) === null) {
                this.poisoned.set(src, {
                    size: stat.size,
                    mtimeMs: stat.mtimeMs,
                });
                this.savePoisonMemo();
            }
        } catch {
            /* cannot identify it; it stays refused for this session only */
        }
    }

    private loadPoisonMemo(): void {
        if (!this.poisonFilePath) {
            return;
        }
        try {
            const parsed = JSON.parse(
                fs.readFileSync(this.poisonFilePath, "utf8")
            );
            for (const entry of parsed?.entries ?? []) {
                if (
                    typeof entry?.src === "string" &&
                    typeof entry?.size === "number" &&
                    typeof entry?.mtimeMs === "number"
                ) {
                    this.poisoned.set(entry.src, {
                        size: entry.size,
                        mtimeMs: entry.mtimeMs,
                    });
                }
            }
        } catch {
            /* no memo yet, or it is unreadable - start empty */
        }
    }

    private savePoisonMemo(): void {
        const filePath = this.poisonFilePath;
        if (!filePath) {
            return;
        }
        const entries: (PoisonEntry & { src: string })[] = [];
        for (const [src, entry] of this.poisoned) {
            if (entry) {
                entries.push({ src, ...entry });
            }
        }
        this.poisonWrites = this.poisonWrites
        .then(async () => {
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            const tmpPath = `${filePath}.tmp-${process.pid}`;
            await fs.promises.writeFile(
                tmpPath,
                JSON.stringify({ version: 1, entries })
            );
            await fs.promises.rename(tmpPath, filePath);
        })
        .catch((error) =>
            console.warn(`Could not record the image worker's skip list: ${error}`)
        );
    }
}
