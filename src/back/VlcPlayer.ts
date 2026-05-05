import { ChildProcess, spawn } from "child_process";
import * as net from "net";
import { pathToFileURL } from "url";
import { VlcState } from "@shared/back/types";

const COMMAND_TIMEOUT_MS = 2000;
const RC_READY_TIMEOUT_MS = 15000;
const VERBOSE = false;

type QueuedCommand = {
    command: string;
    resolve: (value: string) => void;
    reject: (reason?: any) => void;
};

type ActiveCommand = QueuedCommand & {
    timer: ReturnType<typeof setTimeout>;
};

export class VlcPlayer {
    server: ChildProcess | null = null;
    filepath: string = "";
    onStateChange?: (state: VlcState) => void;
    private currentState: VlcState = "idle";
    private socket: net.Socket | null = null;
    private isSocketConnected: boolean = false;
    private commandQueue: QueuedCommand[] = [];
    private activeCommand: ActiveCommand | null = null;
    private buffer: string = "";
    private loopEnabled: boolean = false;
    private ownsProcess: boolean = false;
    private connectPromise: Promise<void> | null = null;

    private constructor(
        private vlcPath: string,
        private args: string[],
        private port: number,
        private initialVol: number,
    ) {}

    get vlcState(): VlcState {
        return this.currentState;
    }

    static async create(vlcPath: string, args: string[], port: number, initialVol: number): Promise<VlcPlayer> {
        const player = new VlcPlayer(vlcPath, args, port, initialVol);

        const connected = await player.tryConnectExisting();
        if (connected) {
            console.log(`VLC: attached to existing instance on port ${port}`);
            return player;
        }

        const fullArgs = [...args, "-I", "rc", "--rc-host", `127.0.0.1:${port}`];
        console.log(`VLC: starting process "${vlcPath}" with args: ${fullArgs.join(" ")}`);
        player.ownsProcess = true;
        player.server = spawn(vlcPath, fullArgs, { windowsHide: true });
        player.server.stdout?.on("data", (d: Buffer) => console.log(`VLC stdout: ${d.toString().trimEnd()}`));
        player.server.stderr?.on("data", (d: Buffer) => console.log(`VLC stderr: ${d.toString().trimEnd()}`));
        player.server.on("spawn", () => {
            console.log(`VLC: process spawned (pid ${player.server?.pid})`);
        });
        player.server.on("error", (err) => {
            console.log(`VLC: failed to start — ${err}`);
            player.server = null;
        });
        player.server.on("exit", (code, signal) => {
            console.log(`VLC: process exited (code=${code}, signal=${signal})`);
        });

        return player;
    }

    private tryConnectExisting(): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = net.connect(this.port, "127.0.0.1");

            const timeout = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, 1000);

            socket.on("connect", () => {
                clearTimeout(timeout);
                this.attachSocket(socket);
                resolve(true);
            });

            socket.on("error", () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });
    }

    private attachSocket(socket: net.Socket): void {
        this.socket = socket;
        this.isSocketConnected = true;
        this.buffer = "";

        socket.on("data", this.onSocketData);
        socket.on("error", this.onSocketError);
        socket.on("close", this.onSocketClose);

        const vlcVol = Math.floor(Math.max(0, Math.min(1, this.initialVol)) * 256);
        socket.write(`volume ${vlcVol}\nrepeat ${this.loopEnabled ? "on" : "off"}\n`);

        this.setState("connected");
    }

    private detachSocket(): net.Socket | null {
        const sock = this.socket;
        if (sock) {
            sock.off("data", this.onSocketData);
            sock.off("error", this.onSocketError);
            sock.off("close", this.onSocketClose);
            this.socket = null;
        }
        this.buffer = "";
        return sock;
    }

    private onSocketData = (data: Buffer): void => {
        const text = data.toString();
        if (VERBOSE) console.log(`VLC rc: ${text.trimEnd()}`);
        this.buffer += text;
        this.tryResolveActive();
    };

    private onSocketError = (err: Error): void => {
        console.log(`VLC: RC socket error — ${err}`);
        this.failAll(err);
    };

    private onSocketClose = (): void => {
        console.log("VLC: RC socket closed");
        this.failAll(new Error("VLC socket closed"));
    };

    private setState(state: VlcState): void {
        if (this.currentState === state) return;
        this.currentState = state;
        this.onStateChange?.(state);
    }

    private failAll(err: any): void {
        this.isSocketConnected = false;
        this.setState("failed");
        const detached = this.detachSocket();
        if (this.activeCommand) {
            clearTimeout(this.activeCommand.timer);
            const cmd = this.activeCommand;
            this.activeCommand = null;
            cmd.reject(err);
        }
        const queue = this.commandQueue;
        this.commandQueue = [];
        for (const item of queue) {
            item.reject(err);
        }
        if (detached && !detached.destroyed) {
            detached.destroy();
        }
    }

    private tryResolveActive(): void {
        if (!this.activeCommand) return;

        // VLC's RC interface terminates each response with a "> " prompt on its
        // own line. Wait for that prompt before resolving.
        if (!this.buffer.trimEnd().endsWith(">")) return;

        const promptIdx = this.buffer.lastIndexOf("\n> ");
        const response = promptIdx >= 0
            ? this.buffer.substring(0, promptIdx)
            : (this.buffer.startsWith("> ") ? "" : this.buffer);

        this.buffer = "";
        const cmd = this.activeCommand;
        this.activeCommand = null;
        clearTimeout(cmd.timer);
        cmd.resolve(response);
        this.runNext();
    }

    private runNext(): void {
        if (this.activeCommand || this.commandQueue.length === 0) return;

        const next = this.commandQueue.shift()!;
        if (!this.socket || !this.isSocketConnected) {
            next.reject(new Error("VLC not connected"));
            this.runNext();
            return;
        }

        // Discard any stale data (connect banner, late response from a timed-out
        // command) so the next prompt we see belongs to this command.
        this.buffer = "";

        const active: ActiveCommand = {
            ...next,
            timer: setTimeout(() => {
                if (this.activeCommand !== active) return;
                console.log(`VLC: command timed out — "${active.command}"`);
                this.failAll(new Error(`VLC command timeout: ${active.command}`));
            }, COMMAND_TIMEOUT_MS),
        };
        this.activeCommand = active;
        this.socket.write(next.command + "\n");
    }

    private async sendCommand(command: string): Promise<string> {
        await this.connectSocket();
        if (!this.socket) {
            throw new Error("VLC not available");
        }

        return new Promise((resolve, reject) => {
            this.commandQueue.push({ command, resolve, reject });
            this.runNext();
        });
    }

    private connectSocket(): Promise<void> {
        if (this.isSocketConnected) {
            return Promise.resolve();
        }
        if (!this.server) {
            return Promise.resolve();
        }
        if (this.connectPromise) {
            return this.connectPromise;
        }

        console.log(`VLC: connecting to RC socket on port ${this.port}`);
        this.setState("connecting");

        this.connectPromise = new Promise<void>((resolve, reject) => {
            const socket = net.connect(this.port, "127.0.0.1");
            let banner = "";

            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error("VLC RC interface timed out"));
            }, RC_READY_TIMEOUT_MS);

            const onBanner = (data: Buffer): void => {
                banner += data.toString();
                if (!banner.trimEnd().endsWith(">")) return;
                clearTimeout(timeout);
                socket.off("data", onBanner);
                console.log("VLC: RC socket ready");
                this.attachSocket(socket);
                resolve();
            };

            socket.on("data", onBanner);
            socket.on("error", (err) => {
                clearTimeout(timeout);
                console.log(`VLC: RC socket error — ${err}`);
                reject(err);
            });
        }).catch((err) => {
            this.setState("failed");
            throw err;
        }).finally(() => {
            this.connectPromise = null;
        });

        return this.connectPromise;
    }

    isProcessAlive(): boolean {
        return !!this.server && !this.server.killed && this.server.exitCode === null;
    }

    connect(): Promise<void> {
        return this.connectSocket();
    }

    private async _play() {
        await this.connectSocket();
        if (!this.socket) { return; }

        await this.stop();

        if (this.filepath) {
            const uri = pathToFileURL(this.filepath).href;
            console.log(`VLC: playing ${uri}`);
            await this.sendCommand(`add ${uri}`);
        }
    }

    setLoop(enabled: boolean): void {
        this.loopEnabled = enabled;
        if (this.socket && this.isSocketConnected) {
            this.socket.write(`repeat ${enabled ? "on" : "off"}\n`);
        }
    }

    async setVol(vol: number): Promise<void> {
        this.initialVol = vol;
        const vlcVol = Math.floor(Math.max(0, Math.min(1, vol)) * 256);
        console.log(`VLC: setting volume to ${vlcVol}`);
        await this.sendCommand(`volume ${vlcVol}`);
    }

    setFile(filepath: string) {
        this.filepath = filepath;
    }

    async resume(): Promise<void> {
        console.log("VLC: resuming");
        await this._play();
    }

    async play(filepath: string): Promise<void> {
        this.filepath = filepath;
        await this._play();
    }

    async stop(): Promise<void> {
        console.log("VLC: stopping");
        await this.sendCommand("stop");
        await this.sendCommand("clear");
    }

    async close(): Promise<void> {
        const err = new Error("VLC closed by client");
        if (this.activeCommand) {
            clearTimeout(this.activeCommand.timer);
            this.activeCommand.reject(err);
            this.activeCommand = null;
        }
        for (const item of this.commandQueue) item.reject(err);
        this.commandQueue = [];
        const sock = this.detachSocket();
        this.isSocketConnected = false;
        if (sock) {
            sock.end();
        }
    }

    async quit(): Promise<void> {
        console.log("VLC: quitting");

        // Abort any in-flight stop/play chain so our final command goes in cleanly.
        if (this.activeCommand) {
            clearTimeout(this.activeCommand.timer);
            this.activeCommand.reject(new Error("VLC quit"));
            this.activeCommand = null;
        }
        this.commandQueue = [];

        if (this.socket && this.isSocketConnected) {
            if (this.ownsProcess) {
                // Queue shutdown — it will be properly sequenced through the
                // prompt-based queue. Timeout handles the case where VLC dies
                // before responding.
                await this.sendCommand("shutdown").catch(() => {});
            } else {
                // We attached to an existing VLC; don't shut it down, but stop
                // any music we started.
                await this.stop().catch(() => {});
            }
        }

        await this.close();
        if (this.ownsProcess && this.server && !this.server.killed) {
            this.server.kill();
        }
    }
}
