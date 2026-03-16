import { ChildProcess, spawn } from "child_process";
import * as net from "net";
import { pathToFileURL } from "url";

export class VlcPlayer {
    server: ChildProcess | null = null;
    filepath: string = "";
    private socket: net.Socket | null = null;
    private commandQueue: { command: string; resolve: (value: string) => void; reject: (reason?: any) => void }[] = [];
    private isProcessingQueue: boolean = false;
    private isSocketConnected: boolean = false;
    private loopEnabled: boolean = false;
    private ownsProcess: boolean = false;

    private constructor(
        private vlcPath: string,
        private args: string[],
        private port: number,
        private initialVol: number,
    ) {}

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
        socket.on("data", (d: Buffer) => console.log(`VLC rc: ${d.toString().trimEnd()}`));
        socket.on("error", (err) => {
            console.log(`VLC: RC socket error — ${err}`);
            this.isSocketConnected = false;
        });
        socket.on("close", () => {
            console.log("VLC: RC socket closed");
            this.isSocketConnected = false;
        });
        const vlcVol = Math.floor(Math.max(0, Math.min(1, this.initialVol)) * 256);
        socket.write(`volume ${vlcVol}\nrepeat ${this.loopEnabled ? "on" : "off"}\n`);
    }

    private async connectSocket(): Promise<void> {
        if (this.socket && this.isSocketConnected) {
            return;
        }
        if (!this.server) {
            return;
        }

        console.log(`VLC: connecting to RC socket on port ${this.port}`);
        return new Promise((resolve, reject) => {
            const socket = net.connect(this.port, "127.0.0.1", () => {
                console.log("VLC: RC socket connected");
                this.attachSocket(socket);
                resolve();
            });

            socket.on("error", (err) => {
                console.log(`VLC: RC socket error — ${err}`);
                reject(err);
            });
        });
    }

    private async sendCommand(command: string): Promise<string> {
        await this.connectSocket();
        if (!this.socket) {
            throw new Error("VLC not available");
        }

        return new Promise((resolve, reject) => {
            this.commandQueue.push({ command, resolve, reject });

            if (!this.isProcessingQueue) {
                this.processQueue();
            }
        });
    }

    private processQueue() {
        if (this.commandQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }

        this.isProcessingQueue = true;
        const { command, resolve, reject } = this.commandQueue.shift()!;

        this.socket?.write(command + "\n");

        const onData = (data: Buffer) => {
            resolve(data.toString());
            this.socket?.removeListener("data", onData);
            this.processQueue();
        };

        this.socket?.on("data", onData);

        this.socket?.on("error", (err) => {
            reject(err);
            this.socket?.removeListener("data", onData);
            this.processQueue();
        });
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
        if (this.socket) {
            this.socket.end();
            this.socket = null;
            this.isSocketConnected = false;
        }
    }

    async quit(): Promise<void> {
        console.log("VLC: quitting");
        if (this.ownsProcess && this.socket && this.isSocketConnected) {
            this.socket.write("shutdown\n");
        }
        await this.close();
        if (this.ownsProcess && this.server && !this.server.killed) {
            this.server.kill();
        }
    }
}
