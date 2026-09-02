import { ChildProcess, fork } from "child_process";
import * as path from "path";
import { ThumbnailJob, ThumbnailResult, ThumbnailTask } from "./thumbnailTypes";

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

type PendingJob = {
    task: ThumbnailTask;
    resolve: () => void;
    reject: (error: Error) => void;
};

export type ThumbnailPoolOptions = {
    spawn?: () => ChildProcess;
    maxJobsPerWorker?: number;
    maxWorkerRssBytes?: number;
    jobTimeoutMs?: number;
    idleTimeoutMs?: number;
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

    /** Sources that took a worker down with them; never retried while this process lives. */
    private readonly poisoned = new Set<string>();

    private readonly spawn: () => ChildProcess;
    private readonly maxJobsPerWorker: number;
    private readonly maxWorkerRssBytes: number;
    private readonly jobTimeoutMs: number;
    private readonly idleTimeoutMs: number;

    constructor(options: ThumbnailPoolOptions = {}) {
        this.spawn =
            options.spawn ?? (() => fork(path.join(__dirname, "thumbnailWorker.js")));
        this.maxJobsPerWorker = options.maxJobsPerWorker ?? MAX_JOBS_PER_WORKER;
        this.maxWorkerRssBytes = options.maxWorkerRssBytes ?? MAX_WORKER_RSS_BYTES;
        this.jobTimeoutMs = options.jobTimeoutMs ?? JOB_TIMEOUT_MS;
        this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
    }

    run(task: ThumbnailTask): Promise<void> {
        if (this.closed) {
            return Promise.reject(new Error("Thumbnail pool is closed"));
        }
        if (this.poisoned.has(task.src)) {
            return Promise.reject(
                new Error(`Skipping "${task.src}": it crashed the image worker earlier this session`)
            );
        }
        return new Promise<void>((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.pump();
        });
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

    private pump(): void {
        if (this.closed || this.active) {
            return;
        }
        const next = this.queue.shift();
        if (!next) {
            this.armIdleTimer();
            return;
        }
        this.clearIdleTimer();

        const worker = this.ensureWorker();
        if (!worker) {
            next.reject(new Error("Could not start the image worker"));
            this.pump();
            return;
        }

        this.active = next;
        this.activeId = this.nextId++;
        const job: ThumbnailJob = { ...next.task, id: this.activeId };

        this.jobTimer = setTimeout(() => this.onJobTimeout(), this.jobTimeoutMs);
        this.jobTimer.unref();

        try {
            worker.send(job);
        } catch (error) {
            this.finishActive(new Error(`Failed to hand the job to the image worker: ${error}`));
            this.discardWorker();
            this.pump();
        }
    }

    private ensureWorker(): ChildProcess | null {
        if (this.worker) {
            return this.worker;
        }
        try {
            const worker = this.spawn();
            this.worker = worker;
            this.jobsThisWorker = 0;
            this.discardingWorker = false;
            worker.on("message", (message) => this.onMessage(message as ThumbnailResult));
            worker.on("exit", (code, signal) => this.onWorkerExit(worker, code, signal));
            worker.on("error", (error) => console.warn(`Image worker error: ${error}`));
            return worker;
        } catch (error) {
            console.warn(`Failed to start the image worker: ${error}`);
            this.worker = null;
            return null;
        }
    }

    private onMessage(result: ThumbnailResult): void {
        if (!this.active || result.id !== this.activeId) {
            return;
        }
        this.jobsThisWorker++;
        this.finishActive(result.ok ? undefined : new Error(result.error));

        if (
            this.jobsThisWorker >= this.maxJobsPerWorker ||
            result.rss > this.maxWorkerRssBytes
        ) {
            this.discardWorker();
        }
        this.pump();
    }

    private onWorkerExit(
        worker: ChildProcess,
        code: number | null,
        signal: NodeJS.Signals | null
    ): void {
        if (worker !== this.worker) {
            return;
        }
        this.worker = null;

        if (this.active && !this.discardingWorker) {
            // The worker died mid-job. That job's source is the only thing it was touching, so
            // name it - this is the line that identifies an image libvips cannot survive.
            const src = this.active.task.src;
            this.poisoned.add(src);
            console.error(
                `Image worker died (code=${code}, signal=${signal}) while processing "${src}". ` +
        "That file will be skipped for the rest of this session."
            );
            this.finishActive(new Error(`Image worker died while processing "${src}"`));
        } else if (!this.discardingWorker) {
            console.warn(`Image worker exited unexpectedly (code=${code}, signal=${signal}).`);
        }

        this.discardingWorker = false;
        this.pump();
    }

    private onJobTimeout(): void {
        const src = this.active?.task.src;
        if (src) {
            this.poisoned.add(src);
            console.error(
                `Image worker timed out after ${this.jobTimeoutMs}ms on "${src}". ` +
        "That file will be skipped for the rest of this session."
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
}
