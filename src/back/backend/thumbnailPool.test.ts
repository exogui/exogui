import { EventEmitter } from "events";
import { ChildProcess } from "child_process";
import { ThumbnailPool } from "./thumbnailPool";
import { ThumbnailJob, ThumbnailResult } from "./thumbnailTypes";

class FakeWorker extends EventEmitter {
    sent: ThumbnailJob[] = [];
    killed = false;
    disconnected = false;

    send(job: ThumbnailJob): boolean {
        this.sent.push(job);
        return true;
    }
    disconnect(): void {
        this.disconnected = true;
    }
    kill(): boolean {
        this.killed = true;
        return true;
    }

    /** Answer the job currently in flight. */
    reply(partial: Partial<ThumbnailResult> = {}): void {
        const job = this.sent[this.sent.length - 1];
        const result = { id: job.id, ok: true, rss: 1024, ...partial } as ThumbnailResult;
        this.emit("message", result);
    }

    die(signal: NodeJS.Signals | null = "SIGSEGV"): void {
        this.emit("exit", null, signal);
    }
}

function makePool(overrides = {}) {
    const workers: FakeWorker[] = [];
    const pool = new ThumbnailPool({
        spawn: () => {
            const worker = new FakeWorker();
            workers.push(worker);
            return worker as unknown as ChildProcess;
        },
        ...overrides,
    });
    return { pool, workers };
}

const thumb = (src: string) => ({ kind: "thumb" as const, src, dest: `${src}.jpg`, maxEdge: 512 });

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe("ThumbnailPool", () => {
    it("spawns lazily and resolves a completed job", async () => {
        const { pool, workers } = makePool();
        expect(workers).toHaveLength(0);

        const done = pool.run(thumb("/a.png"));
        await flush();
        expect(workers).toHaveLength(1);
        expect(workers[0].sent[0]).toMatchObject({ kind: "thumb", src: "/a.png", maxEdge: 512 });

        workers[0].reply();
        await expect(done).resolves.toBeUndefined();
        pool.close();
    });

    it("runs one job at a time and preserves order", async () => {
        const { pool, workers } = makePool();
        const first = pool.run(thumb("/1.png"));
        const second = pool.run(thumb("/2.png"));
        await flush();

        expect(workers[0].sent.map((j) => j.src)).toEqual(["/1.png"]);
        workers[0].reply();
        await first;
        await flush();

        expect(workers[0].sent.map((j) => j.src)).toEqual(["/1.png", "/2.png"]);
        workers[0].reply();
        await expect(second).resolves.toBeUndefined();
        pool.close();
    });

    it("recycles the worker after the job limit", async () => {
        const { pool, workers } = makePool({ maxJobsPerWorker: 2 });

        for (let i = 0; i < 3; i++) {
            const done = pool.run(thumb(`/${i}.png`));
            await flush();
            workers[workers.length - 1].reply();
            await done;
            await flush();
        }

        expect(workers).toHaveLength(2);
        expect(workers[0].disconnected).toBe(true);
        pool.close();
    });

    it("recycles early when the worker reports high rss", async () => {
        const { pool, workers } = makePool({ maxWorkerRssBytes: 100 });

        const first = pool.run(thumb("/big.png"));
        await flush();
        workers[0].reply({ rss: 500 });
        await first;
        await flush();

        expect(workers[0].disconnected).toBe(true);

        const second = pool.run(thumb("/next.png"));
        await flush();
        expect(workers).toHaveLength(2);
        workers[1].reply();
        await second;
        pool.close();
    });

    it("names the source when a worker dies mid-job and refuses to retry it", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const { pool, workers } = makePool();

        const done = pool.run(thumb("/poison.png"));
        await flush();
        workers[0].die("SIGSEGV");

        await expect(done).rejects.toThrow(/poison\.png/);
        expect(error.mock.calls[0][0]).toContain("/poison.png");
        expect(error.mock.calls[0][0]).toContain("SIGSEGV");

        await expect(pool.run(thumb("/poison.png"))).rejects.toThrow(/crashed the image worker/);
        expect(workers).toHaveLength(1);
        pool.close();
    });

    it("keeps serving other images after a crash", async () => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        const { pool, workers } = makePool();

        const bad = pool.run(thumb("/bad.png"));
        await flush();
        workers[0].die();
        await expect(bad).rejects.toThrow();
        await flush();

        const good = pool.run(thumb("/good.png"));
        await flush();
        expect(workers).toHaveLength(2);
        workers[1].reply();
        await expect(good).resolves.toBeUndefined();
        pool.close();
    });

    it("times out a wedged job, drops the worker and poisons the source", async () => {
        jest.useFakeTimers();
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        const { pool, workers } = makePool({ jobTimeoutMs: 1000 });

        const done = pool.run(thumb("/slow.png"));
        await Promise.resolve();
        jest.advanceTimersByTime(1000);

        await expect(done).rejects.toThrow(/Timed out/);
        expect(workers[0].disconnected).toBe(true);
        await expect(pool.run(thumb("/slow.png"))).rejects.toThrow(/crashed the image worker/);
        pool.close();
    });

    it("drops an idle worker", async () => {
        jest.useFakeTimers();
        const { pool, workers } = makePool({ idleTimeoutMs: 500 });

        const done = pool.run(thumb("/a.png"));
        await Promise.resolve();
        workers[0].reply();
        await done;
        await Promise.resolve();

        jest.advanceTimersByTime(500);
        expect(workers[0].disconnected).toBe(true);
        pool.close();
    });

    it("rejects queued and new work once closed", async () => {
        const { pool, workers } = makePool();
        const inflight = pool.run(thumb("/1.png"));
        const queued = pool.run(thumb("/2.png"));
        await flush();

        pool.close();
        await expect(queued).rejects.toThrow(/closed/);
        await expect(pool.run(thumb("/3.png"))).rejects.toThrow(/closed/);
        expect(workers[0].disconnected).toBe(true);
        inflight.catch(() => undefined);
    });
});
