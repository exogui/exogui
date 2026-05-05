import * as net from "net";
import { VlcPlayer } from "./VlcPlayer";
import { VlcState } from "@shared/back/types";

// Fully controlled mock socket — avoids real net.Socket lifecycle side-effects.
function makeMockSocket() {
    const listeners: Record<string, Array<(...args: any[]) => void>> = {};
    return {
        on(event: string, fn: (...args: any[]) => void) {
            (listeners[event] ??= []).push(fn);
            return this;
        },
        off(event: string, fn: (...args: any[]) => void) {
            listeners[event] = (listeners[event] ?? []).filter((f) => f !== fn);
            return this;
        },
        emit(event: string, ...args: any[]) {
            (listeners[event] ?? []).slice().forEach((f) => f(...args));
        },
        write: jest.fn().mockReturnValue(true),
        end: jest.fn(),
        destroy: jest.fn(),
        destroyed: false,
    };
}

type MockSocket = ReturnType<typeof makeMockSocket>;

function makeFakeProcess(alive = true) {
    return {
        killed: !alive,
        exitCode: alive ? null : 0,
        pid: 1234,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
    } as any;
}

// Bypass the private constructor to build a player without spawning anything.
function makePlayer(): VlcPlayer {
    const player = new (VlcPlayer as any)("vlc", [], 12345, 0.5) as VlcPlayer;
    player.server = makeFakeProcess(true);
    return player;
}

// Helper: mock the next net.connect call and return the mock socket.
function mockConnect(socket: MockSocket) {
    jest.spyOn(net, "connect").mockReturnValueOnce(socket as any);
}

afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe("VlcPlayer state machine", () => {
    test("initial state is idle", () => {
        const player = makePlayer();
        expect(player.vlcState).toBe<VlcState>("idle");
    });

    test("transitions idle → connecting → connected on successful connect", async () => {
        const states: VlcState[] = [];
        const player = makePlayer();
        player.onStateChange = (s) => states.push(s);

        const socket = makeMockSocket();
        mockConnect(socket);

        const p = player.connect();
        socket.emit("data", Buffer.from("\n> "));
        await p;

        expect(states).toEqual<VlcState[]>(["connecting", "connected"]);
        expect(player.vlcState).toBe<VlcState>("connected");
    });

    test("transitions connecting → failed on TCP error", async () => {
        const states: VlcState[] = [];
        const player = makePlayer();
        player.onStateChange = (s) => states.push(s);

        const socket = makeMockSocket();
        mockConnect(socket);

        const p = player.connect();
        socket.emit("error", new Error("ECONNREFUSED"));
        await expect(p).rejects.toThrow();

        expect(states).toEqual<VlcState[]>(["connecting", "failed"]);
        expect(player.vlcState).toBe<VlcState>("failed");
    });

    test("transitions connecting → failed on RC timeout", async () => {
        jest.useFakeTimers();
        const states: VlcState[] = [];
        const player = makePlayer();
        player.onStateChange = (s) => states.push(s);

        const socket = makeMockSocket();
        mockConnect(socket);

        const p = player.connect();
        jest.advanceTimersByTime(15001);
        await expect(p).rejects.toThrow("timed out");

        expect(states).toEqual<VlcState[]>(["connecting", "failed"]);
    });

    test("transitions connected → failed when socket closes", async () => {
        const states: VlcState[] = [];
        const player = makePlayer();

        const socket = makeMockSocket();
        mockConnect(socket);

        const p = player.connect();
        socket.emit("data", Buffer.from("\n> "));
        await p;
        expect(player.vlcState).toBe<VlcState>("connected");

        player.onStateChange = (s) => states.push(s);
        socket.emit("close");

        expect(states).toEqual<VlcState[]>(["failed"]);
        expect(player.vlcState).toBe<VlcState>("failed");
    });

    test("reconnects to connected after failure", async () => {
        const player = makePlayer();

        const socket1 = makeMockSocket();
        const socket2 = makeMockSocket();
        jest.spyOn(net, "connect")
        .mockReturnValueOnce(socket1 as any)
        .mockReturnValueOnce(socket2 as any);

        const p1 = player.connect();
        socket1.emit("data", Buffer.from("\n> "));
        await p1;
        expect(player.vlcState).toBe<VlcState>("connected");

        socket1.emit("close");
        expect(player.vlcState).toBe<VlcState>("failed");

        const p2 = player.connect();
        socket2.emit("data", Buffer.from("\n> "));
        await p2;
        expect(player.vlcState).toBe<VlcState>("connected");
    });

    test("concurrent connect() calls share the same promise", async () => {
        const player = makePlayer();

        const socket = makeMockSocket();
        mockConnect(socket);

        const p1 = player.connect();
        const p2 = player.connect();
        expect(p1).toBe(p2);

        socket.emit("data", Buffer.from("\n> "));
        await Promise.all([p1, p2]);

        expect(player.vlcState).toBe<VlcState>("connected");
        // net.connect should only have been called once
        expect(net.connect).toHaveBeenCalledTimes(1);
    });

    test("onStateChange is not emitted when state does not change", async () => {
        const player = makePlayer();
        const spy = jest.fn();
        player.onStateChange = spy;

        const socket1 = makeMockSocket();
        const socket2 = makeMockSocket();
        jest.spyOn(net, "connect")
        .mockReturnValueOnce(socket1 as any)
        .mockReturnValueOnce(socket2 as any);

        const p1 = player.connect();
        socket1.emit("data", Buffer.from("\n> "));
        await p1;

        // Second connect while already connected should be a no-op
        await player.connect();

        const connectedCalls = spy.mock.calls.filter(([s]) => s === "connected");
        expect(connectedCalls).toHaveLength(1);
        expect(net.connect).toHaveBeenCalledTimes(1);
    });

    test("banner split across multiple data events resolves correctly", async () => {
        const player = makePlayer();
        const socket = makeMockSocket();
        mockConnect(socket);

        const p = player.connect();
        // Send the prompt in two chunks
        socket.emit("data", Buffer.from("\n"));
        socket.emit("data", Buffer.from("> "));
        await p;

        expect(player.vlcState).toBe<VlcState>("connected");
    });
});

describe("VlcPlayer.isProcessAlive", () => {
    test("returns true when process is running", () => {
        const player = makePlayer();
        player.server = makeFakeProcess(true);
        expect(player.isProcessAlive()).toBe(true);
    });

    test("returns false when server is null", () => {
        const player = makePlayer();
        player.server = null;
        expect(player.isProcessAlive()).toBe(false);
    });

    test("returns false when process has exited", () => {
        const player = makePlayer();
        player.server = makeFakeProcess(false);
        expect(player.isProcessAlive()).toBe(false);
    });

    test("returns false when process was killed", () => {
        const player = makePlayer();
        const proc = makeFakeProcess(true);
        proc.killed = true;
        player.server = proc;
        expect(player.isProcessAlive()).toBe(false);
    });
});
