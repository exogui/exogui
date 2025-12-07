import { app, BrowserWindow, dialog, shell } from "@electron/remote";
import { SocketClient } from "@shared/back/SocketClient";
import {
    BackIn,
    BackOut
} from "@shared/back/types";
import { IMainWindowExternal } from "@shared/interfaces";
import { InitRendererChannel, InitRendererData } from "@shared/IPC";
import { setTheme } from "@shared/Theme";
import { createErrorProxy } from "@shared/Util";
import * as electron from "electron";
import { OpenDialogOptions } from "electron";
import * as path from "path";
import { isDev } from "./Util";

console.log("preloading");

async function waitForConnection(host: string): Promise<WebSocket> {
    while (true) {
        try {
            const socket = await SocketClient.connect(WebSocket, host, "exogui-launcher");
            console.log("Initial connection established to backend");
            return socket;
        } catch (error) {
            console.log("Initial connection failed to backend, waiting 5 seconds...");
            await new Promise<void>(resolve => setTimeout(resolve, 5000));
        }
    }
}

/**
 * Object with functions that bridge between this and the Main processes
 * (Note: This is mostly a left-over from when "node integration" was disabled.
 *        It might be a good idea to move this to the Renderer?)
 */
(window.External as IMainWindowExternal) = {
    installed: createErrorProxy("installed"),
    version: createErrorProxy("version"),
    platform: (process.platform + "") as NodeJS.Platform, // (Coerce to string to make sure its not a remote object)

    minimize() {
        const currentWindow = BrowserWindow.getFocusedWindow();
        currentWindow?.minimize();
    },

    maximize() {
        const currentWindow = BrowserWindow.getFocusedWindow();
        if (currentWindow?.isMaximized()) {
            currentWindow.unmaximize();
        } else {
            currentWindow?.maximize();
        }
    },

    close() {
        const currentWindow = BrowserWindow.getFocusedWindow();
        currentWindow?.close();
    },

    restart() {
        app.relaunch();
        app.quit();
    },

    showOpenDialogSync(options: OpenDialogOptions): string[] | undefined {
        // @HACK: Electron set the incorrect return type for "showOpenDialogSync".
        return dialog.showOpenDialogSync(options) as any;
    },

    toggleDevtools(): void {
        BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools();
    },

    preferences: {
        data: createErrorProxy("preferences.data"),
        onUpdate: undefined,
    },

    config: createErrorProxy("config"),

    commandMappings: createErrorProxy("commandMappings"),

    log: {
        entries: [],
        offset: 0,
    },

    isDev,

    isBackRemote: createErrorProxy("isBackRemote"),

    back: new SocketClient(WebSocket),

    fileServerPort: -1,

    backUrl: createErrorProxy("backUrl"),

    initialThemes: createErrorProxy("initialThemes"),
    initialPlaylists: createErrorProxy("initialPlaylists"),
    initialLocaleCode: createErrorProxy("initialLocaleCode"),

    waitUntilInitialized: async () => {
        if (!isInitDone) {
            return onInit();
        }
    },
};

let isInitDone: boolean = false;
const onInit = (async () => {
    // Fetch connection setup data from main process
    const data: InitRendererData =
        electron.ipcRenderer.sendSync(InitRendererChannel);
    window.External.installed = data.installed;
    window.External.version = data.version;
    window.External.isBackRemote = data.isBackRemote;
    window.External.backUrl = new URL(data.host);
    // Connect to the backend
    const socket = await waitForConnection(data.host);
    window.External.back.url = data.host;
    window.External.back.secret = "exogui-launcher";
    window.External.back.setSocket(socket);

    registerHandlers();

    // Load initial renderer data from backend
    const { config, preferences, commandMappings, fileServerPort,
        log, themes, playlists, localeCode
    } = await window.External.back.request(BackIn.GET_RENDERER_INIT_DATA);
    window.External.preferences.data = preferences;
    window.External.config = {
        data: config,
        fullExodosPath: path.resolve(config.exodosPath),
        fullJsonFolderPath: path.resolve(config.exodosPath, config.jsonFolderPath)
    };
    window.External.commandMappings = commandMappings;
    window.External.fileServerPort = fileServerPort;
    window.External.log.entries = log;
    window.External.initialThemes = themes;
    window.External.initialPlaylists = playlists;
    window.External.initialLocaleCode = localeCode;
    if (window.External.config.data.currentTheme) {
        setTheme(window.External.config.data.currentTheme);
    }

    // Start keepalive routine
    setInterval(async () => {
        try {
            await window.External.back.request(BackIn.KEEP_ALIVE);
        } catch {
            /** Ignore any bad response */
        }
    }, 30000);

    isInitDone = true;
});

function registerHandlers() {
    window.External.back.register(BackOut.UPDATE_PREFERENCES_RESPONSE, (event, data) => {
        window.External.preferences.data = data;
    });

    window.External.back.register(BackOut.OPEN_DIALOG, async (event, options) => {
        const res = await dialog.showMessageBox(options)
        .then((res) => {
            return res.response;
        });
        return res;
    });

    window.External.back.register(BackOut.OPEN_EXTERNAL, async (event, url, options) => {
        return shell.openExternal(url, options);
    });
}
