import { app, BrowserWindow, WebContents } from "electron";
import * as fs from "fs";
import * as path from "path";

const MEMORY_POLL_INTERVAL_MS = 10_000;
const LOG_FILENAME = "exogui-debug.log";

let logStream: fs.WriteStream | undefined;
let logFilePath: string | undefined;
let memoryPollTimer: NodeJS.Timeout | undefined;

function ts(): string {
    return new Date().toISOString();
}

function write(line: string): void {
    const formatted = `[${ts()}] ${line}`;
    console.log(formatted);
    if (logStream) {
        try {
            logStream.write(formatted + "\n");
        } catch {
            /* ignore */
        }
    }
}

function safeStringify(value: unknown): string {
    try {
        if (value instanceof Error) {
            return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
        }
        return typeof value === "string" ? value : JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function initRendererDiagnostics(mainFolderPath: string): void {
    try {
        logFilePath = path.join(mainFolderPath, LOG_FILENAME);
        logStream = fs.createWriteStream(logFilePath, { flags: "a" });
        logStream.on("error", (err) => {
            console.error("[Diagnostics] log file stream error:", err);
        });
    } catch (err) {
        console.error("[Diagnostics] failed to open log file:", err);
    }

    write(`[Diagnostics] === session start === pid=${process.pid} platform=${process.platform} arch=${process.arch} electron=${process.versions.electron} chrome=${process.versions.chrome} node=${process.versions.node}`);
    write(`[Diagnostics] log file: ${logFilePath ?? "<disabled>"}`);

    process.on("uncaughtException", (err) => {
        write(`[Diagnostics][main] uncaughtException: ${safeStringify(err)}`);
    });
    process.on("unhandledRejection", (reason) => {
        write(`[Diagnostics][main] unhandledRejection: ${safeStringify(reason)}`);
    });

    app.on("child-process-gone", (_event, details) => {
        write(`[Diagnostics][app] child-process-gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode} name=${details.name ?? ""} serviceName=${details.serviceName ?? ""}`);
    });
    app.on("render-process-gone", (_event, webContents, details) => {
        write(`[Diagnostics][app] render-process-gone reason=${details.reason} exitCode=${details.exitCode} url=${safeUrl(webContents)}`);
    });
    app.on("gpu-info-update", () => {
        // Fires often; intentionally silent. Hook present so we can opt in if needed.
    });
    app.on("gpu-process-crashed" as any, (_event: any, killed: boolean) => {
        write(`[Diagnostics][app] gpu-process-crashed killed=${killed}`);
    });

    startMemoryPolling();
}

function safeUrl(webContents: WebContents): string {
    try {
        return webContents.getURL();
    } catch {
        return "<unknown>";
    }
}

export function attachWindowDiagnostics(window: BrowserWindow): void {
    const wc = window.webContents;
    const tag = `[Diagnostics][wc:${wc.id}]`;

    write(`${tag} attached. url=${safeUrl(wc)}`);

    wc.on("did-start-loading", () => write(`${tag} did-start-loading`));
    wc.on("did-stop-loading", () => write(`${tag} did-stop-loading`));
    wc.on("dom-ready", () => write(`${tag} dom-ready`));
    wc.on("did-finish-load", () => write(`${tag} did-finish-load`));
    wc.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
        write(`${tag} did-fail-load code=${errorCode} desc="${errorDescription}" url=${validatedURL} mainFrame=${isMainFrame}`);
    });
    wc.on("did-fail-provisional-load" as any, (_e: any, errorCode: number, errorDescription: string, validatedURL: string) => {
        write(`${tag} did-fail-provisional-load code=${errorCode} desc="${errorDescription}" url=${validatedURL}`);
    });
    wc.on("preload-error", (_e, preloadPath, error) => {
        write(`${tag} preload-error path=${preloadPath} error=${safeStringify(error)}`);
    });
    wc.on("render-process-gone", (_e, details) => {
        write(`${tag} render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
    });
    wc.on("unresponsive", () => {
        const metrics = collectWindowMetrics();
        write(`${tag} *** UNRESPONSIVE *** ${metrics}`);
    });
    wc.on("responsive", () => {
        write(`${tag} responsive (recovered)`);
    });
    wc.on("plugin-crashed" as any, (_e: any, name: string, version: string) => {
        write(`${tag} plugin-crashed name=${name} version=${version}`);
    });
    wc.on("destroyed", () => write(`${tag} destroyed`));
    wc.on("console-message", (_e, level, message, line, sourceId) => {
        const levelTxt = ["verbose", "info", "warn", "error"][level] ?? `lvl${level}`;
        write(`${tag}[console:${levelTxt}] ${message} (${sourceId}:${line})`);
    });

    window.on("close", () => write(`${tag} window close`));
    window.on("closed", () => write(`${tag} window closed`));
    window.on("show", () => write(`${tag} window show`));
    window.on("hide", () => write(`${tag} window hide`));
    window.on("minimize", () => write(`${tag} window minimize`));
    window.on("restore", () => write(`${tag} window restore`));
    window.on("focus", () => write(`${tag} window focus`));
    window.on("blur", () => write(`${tag} window blur`));
}

function collectWindowMetrics(): string {
    try {
        const metrics = app.getAppMetrics();
        return metrics
        .map((m) => `${m.type}${m.name ? `:${m.name}` : ""}(pid=${m.pid} cpu=${m.cpu?.percentCPUUsage?.toFixed(1)}% mem=${Math.round((m.memory?.workingSetSize ?? 0) / 1024)}MB priv=${Math.round((m.memory?.privateBytes ?? 0) / 1024)}MB)`)
        .join(" | ");
    } catch (err) {
        return `<metrics-error: ${safeStringify(err)}>`;
    }
}

function startMemoryPolling(): void {
    if (memoryPollTimer) {
        return;
    }
    memoryPollTimer = setInterval(() => {
        write(`[Diagnostics][metrics] ${collectWindowMetrics()}`);
    }, MEMORY_POLL_INTERVAL_MS);
    if (memoryPollTimer.unref) {
        memoryPollTimer.unref();
    }
}

export function shutdownRendererDiagnostics(): void {
    if (memoryPollTimer) {
        clearInterval(memoryPollTimer);
        memoryPollTimer = undefined;
    }
    write("[Diagnostics] === session end ===");
    if (logStream) {
        try {
            logStream.end();
        } catch {
            /* ignore */
        }
        logStream = undefined;
    }
}
