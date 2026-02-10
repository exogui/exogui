import {
    BackInit,
    BackInitArgs,
    BackOut,
    PlaylistUpdateData,
    WrappedResponse,
} from "@shared/back/types";
import { IGameInfo } from "@shared/game/interfaces";
import { GamePlaylist } from "@shared/interfaces";
import { ILogEntry, ILogPreEntry } from "@shared/Log/interface";
import { EmptyCommandMapping } from "@shared/mappings/interfaces";
import { PreferencesFile } from "@shared/preferences/PreferencesFile";
import {
    createErrorProxy,
    isErrorProxy,
    readJsonFile,
} from "@shared/Util";
import { EventEmitter } from "events";
import * as path from "path";
import { FileServer } from "./backend/fileServer";
import { ConfigFile } from "./config/ConfigFile";
import { loadExecMappingsFile } from "./Execs";
import { logFactory } from "./logging";
import { PlaylistManager } from "./playlist/PlaylistManager";
import { registerRequestCallbacks } from "./responses";
import { SocketServer } from "./SocketServer";
import { loadThemes } from "./Themes";
import { BackState } from "./types";
import { VlcPlayer } from "./VlcPlayer";
// Make sure the process.send function is available
type Required<T> = T extends undefined ? never : T;
const send: Required<typeof process.send> = process.send
    ? process.send.bind(process)
    : () => {
        throw new Error("process.send is undefined.");
    };

const state: BackState = {
    isInitialized: false,
    isExit: false,
    socketServer: new SocketServer(),
    server: createErrorProxy("server"),
    fileServer: undefined,
    secret: createErrorProxy("secret"),
    preferences: createErrorProxy("preferences"),
    config: createErrorProxy("config"),
    configFolder: createErrorProxy("configFolder"),
    exePath: createErrorProxy("exePath"),
    basePath: createErrorProxy("basePath"),
    localeCode: createErrorProxy("countryCode"),
    playlistManager: new PlaylistManager(),
    messageQueue: [],
    isHandling: false,
    messageEmitter: new EventEmitter() as any,
    init: {
        0: false,
        1: false,
    },
    initEmitter: new EventEmitter() as any,
    logs: [],
    themeFiles: [],
    execMappings: [],
    queries: {},
    commandMappings: {
        defaultMapping: EmptyCommandMapping,
        commandsMapping: [],
    },
    vlcPlayer: undefined,
};

export const preferencesFilename = "preferences.json";
export const configFilename = "config.json";
const commandMappingsFilename = `mappings.${process.platform}.json`;

process.on("message", initialize);

function getEmbeddedExodosPath(): string {
    if (process.env.APPIMAGE || process.platform === "darwin") {
        return "../";
    }
    return "../../";
}
process.on("disconnect", () => {
    exit();
});

async function initialize(message: any, _: any): Promise<void> {
    if (state.isInitialized) {
        return;
    }
    state.isInitialized = true;

    const addLog = (entry: ILogEntry): number => { return state.logs.push(entry) - 1; };
    (global as any).log = logFactory(state.socketServer, addLog, false);

    const content: BackInitArgs = JSON.parse(message);
    state.secret = content.secret;
    state.configFolder = content.configFolder;
    state.localeCode = "unknown";
    state.exePath = content.exePath;
    state.basePath = content.basePath;

    state.preferences = await PreferencesFile.readOrCreateFile(
        path.join(state.configFolder, preferencesFilename)
    );
    state.config = await ConfigFile.readOrCreateFile(
        path.join(state.configFolder, configFilename)
    );
    const mappingsPath = path.join(state.basePath, commandMappingsFilename);
    try {
        state.commandMappings = await readJsonFile(mappingsPath);
    } catch (e) {
        console.error(
            `Cannot load mappings file "${commandMappingsFilename}". ${e}. Check if file exists and have valid values. Without that file most of the entries won't work.`
        );
    }

    await ConfigFile.readOrCreateFile(
        path.join(state.configFolder, configFilename)
    );
    const exodosPath = state.config.useEmbeddedExodosPath
        ? getEmbeddedExodosPath()
        : state.config.exodosPath;
    if (!path.isAbsolute(exodosPath)) {
        state.config.exodosPath = path.join(state.basePath, exodosPath);
    } else {
        state.config.exodosPath = exodosPath;
    }
    console.log("Exodos path: " + state.config.exodosPath);

    console.info(
        `Starting exogui with ${state.config.exodosPath} exodos path.`
    );
    console.log("Starting directory: " + process.cwd());

    try {
        process.chdir(state.configFolder);
        console.log("New directory: " + state.configFolder);
    } catch (err) {
        console.log("chdir: " + err);
    }

    await initializePlaylistManager();

    // Load Themes from static folder
    const themeFolderPath = path.join(__dirname, "../window/styles/themes");
    state.themeFiles = await loadThemes(themeFolderPath);
    console.log(`Loaded ${state.themeFiles.length} themes`);

    // Load Exec Mappings
    loadExecMappingsFile(
        path.join(state.config.exodosPath, state.config.jsonFolderPath),
        (content) => log({ source: "Launcher", content })
    )
    .then((data) => {
        state.execMappings = data;
    })
    .catch((error) => {
        log({
            source: "Launcher",
            content: `Failed to load exec mappings file. Ignore if on Windows. - ${error}`,
        });
    })
    .finally(() => {
        state.init[BackInit.EXEC] = true;
        state.initEmitter.emit(BackInit.EXEC);
    });

    state.fileServer = new FileServer(state.config, log);
    await state.fileServer.start();

    registerRequestCallbacks(state);

    await startMainServer();

    // Initialize VLC player
    try {
        switch (process.platform) {
            case "win32": {
                state.vlcPlayer = new VlcPlayer(path.join(state.config.exodosPath, "ThirdParty", "VLC", "x64", "vlc.exe"), [],
                    state.config.vlcPort, state.preferences.gameMusicVolume);
                break;
            }
            default: {
                console.log("Disabled VLC player (unsupported on this operating system)");
                break;
            }
        }
    } catch (err) {
        log({
            source: "VLC",
            content: `${err}`
        });
        console.log(`Error starting VLC server: ${err}`);
    }

    send(state.socketServer.port);
}

async function startMainServer() {
    await state.socketServer.listen(state.config.backPortMin, state.config.backPortMax, "localhost");

    if (state.socketServer.port < 0) {
        console.log("Back - Failed to open Socket Server, Exiting...");
        setImmediate(() => exit());
        return;
    }

    console.log("Back - Opened Websocket");
}

async function initializePlaylistManager() {
    const playlistFolder = path.join(
        state.config.exodosPath,
        state.config.playlistFolderPath
    );

    const onPlaylistAddOrUpdate = function (playlist: GamePlaylist): void {
        // Clear all query caches that uses this playlist
        const hashes = Object.keys(state.queries);
        for (const hash of hashes) {
            const cache = state.queries[hash];
            if (cache.query.playlistId === playlist.filename) {
                delete state.queries[hash]; // Clear query from cache
            }
        }
        broadcast<PlaylistUpdateData>({
            id: "",
            type: BackOut.PLAYLIST_UPDATE,
            data: playlist,
        });
    };

    state.playlistManager.init({
        playlistFolder,
        log,
        onPlaylistAddOrUpdate,
    });

    state.init[BackInit.PLAYLISTS] = true;
    state.initEmitter.emit(BackInit.PLAYLISTS);
}

/** Exit the process cleanly. */
export function exit() {
    if (!state.isExit) {
        state.isExit = true;

        // Broadcast quit signal to all connected clients (including Main process)
        state.socketServer.broadcast(BackOut.QUIT);

        Promise.all([
            // Close WebSocket server
            isErrorProxy(state.server)
                ? undefined
                : new Promise<void>((resolve) =>
                    state.server.close((error) => {
                        if (error) {
                            console.warn(
                                "An error occurred whie closing the WebSocket server.",
                                error
                            );
                        }
                        resolve();
                    })
                ),
            // Close file server
            new Promise<void>((resolve) =>
                state.fileServer?.server.close((error) => {
                    if (error) {
                        console.warn(
                            "An error occurred whie closing the file server.",
                            error
                        );
                    }
                    resolve();
                })
            ),
        ]).then(() => {
            process.exit();
        });
    }
}

export function onGameUpdated(game: IGameInfo): void {
    state.socketServer.broadcast(BackOut.GAME_CHANGE, game);
}

function broadcast<T>(response: WrappedResponse<T>): number {
    let count = 0;
    if (!isErrorProxy(state.server)) {
        const message = JSON.stringify(response);
        state.server.clients.forEach((socket) => {
            if (socket.onmessage === onMessageWrap) {
                console.log(`Broadcast: ${BackOut[response.type]}`);
                // (Check if authorized)
                socket.send(message);
                count += 1;
            }
        });
    }
    return count;
}

function log(preEntry: ILogPreEntry, id?: string): void {
    const entry: ILogEntry = {
        source: preEntry.source,
        content: preEntry.content,
        timestamp: Date.now(),
    };

    if (typeof entry.source !== "string") {
        console.warn(
            `Type Warning! A log entry has a source of an incorrect type!\n  Type: "${typeof entry.source}"\n  Value: "${entry.source
            }"`
        );
        entry.source = entry.source + "";
    }
    if (typeof entry.content !== "string") {
        console.warn(
            `Type Warning! A log entry has content of an incorrect type!\n  Type: "${typeof entry.content}"\n  Value: "${entry.content
            }"`
        );
        entry.content = entry.content + "";
    }
    state.logs.push(entry);

    broadcast({
        id: id || "",
        type: BackOut.LOG_ENTRY_ADDED,
        data: {
            entry,
            index: state.logs.length - 1,
        },
    });
}
