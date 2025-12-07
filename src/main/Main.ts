import * as remoteMain from "@electron/remote/main";
import { SocketClient } from "@shared/back/SocketClient";
import {
    BackIn,
    BackInitArgs,
    BackOut
} from "@shared/back/types";
import { IAppConfigData } from "@shared/config/interfaces";
import { APP_TITLE } from "@shared/constants";
import { WindowIPC } from "@shared/interfaces";
import { InitRendererChannel, InitRendererData } from "@shared/IPC";
import {
    IAppPreferencesData,
    IAppPreferencesDataMainWindow,
} from "@shared/preferences/interfaces";
import { createErrorProxy } from "@shared/Util";
import { ChildProcess, fork } from "child_process";
import {
    app,
    BrowserWindow,
    ipcMain,
    IpcMainEvent,
    screen,
    session,
    shell
} from "electron";
import * as fs from "fs";
import * as path from "path";
import * as WebSocket from "ws";
import { Init } from "./types";
import * as Util from "./Util";

type MainState = {
    window?: BrowserWindow;
    _installed?: boolean;
    backHost: URL;
    _secret: string;
    /** Version of the launcher (timestamp of when it was built). Negative value if not found or not yet loaded. */
    _version: number;
    preferences?: IAppPreferencesData;
    config?: IAppConfigData;
    socket: SocketClient<WebSocket>;
    backProc?: ChildProcess;
    _sentLocaleCode: boolean;
    /** If the main is about to quit. */
    isQuitting: boolean;
    /** Path of the folder containing the config and preferences files. */
    mainFolderPath: string;
};

export function main(init: Init): void {
    const state: MainState = {
        window: undefined,
        _installed: undefined,
        backHost: new URL("ws://localhost"),
        _secret: "",
        /** Version of the launcher (timestamp of when it was built). Negative value if not found or not yet loaded. */
        _version: -2,
        preferences: undefined,
        config: undefined,
        socket: new SocketClient(WebSocket),
        backProc: undefined,
        _sentLocaleCode: false,
        isQuitting: false,
        mainFolderPath: createErrorProxy("mainFolderPath"),
    };

    startup();

    async function startup() {
        if (process.env.APPIMAGE) {
            app.commandLine.appendSwitch("no-sandbox");
        }
        app.disableHardwareAcceleration();

        // Add app event listener(s)
        app.once("ready", onAppReady);
        app.once("window-all-closed", onAppWindowAllClosed);
        app.once("will-quit", onAppWillQuit);
        app.once("web-contents-created", onAppWebContentsCreated);
        app.on("activate", onAppActivate);

        // Add IPC event listener(s)
        ipcMain.on(InitRendererChannel, onInit);

        // ---- Initialize ----
        // Check if installed
        state._installed = false;
        state.mainFolderPath = Util.getMainFolderPath();
        console.log("Main folder: " + state.mainFolderPath);
        const versionFile = fs.readFileSync(path.join(state.mainFolderPath, ".version"));
        state._version = versionFile
            ? parseInt(
                versionFile.toString().replace(/[^\d]/g, ""),
                10
            ) // (Remove all non-numerical characters, then parse it as a string)
            : -1; // (Version not found error code)

        // Start back process
        if (!init.args["connect-remote"]) {
            await new Promise<void>((resolve, reject) => {
                state.backProc = fork(
                    path.join(__dirname, "../back/index.js"),
                    undefined,
                    { detached: true }
                );
                // Wait for process to initialize
                state.backProc.once("message", (msg) => {
                    const port = parseInt(msg.toString());
                    if (port >= 0) {
                        state.backHost.port = port.toString();
                        resolve();
                    } else {
                        reject(
                            new Error(
                                "Failed to start server in back process. Perhaps because it could not find an available port."
                            )
                        );
                    }
                });
                // Send initialize message
                const msg: BackInitArgs = {
                    configFolder: state.mainFolderPath,
                    secret: state._secret,
                    isDev: Util.isDev,
                    exePath: path.dirname(app.getPath("exe")),
                    basePath: process.env.APPIMAGE
                        ? app.getAppPath()
                        : (process.platform === "darwin" && !Util.isDev)
                            ? path.dirname(path.dirname(path.dirname(path.dirname(app.getPath("exe")))))
                            : process.cwd(),
                    acceptRemote: !!init.args["host-remote"],
                };
                state.backProc.send(JSON.stringify(msg));
            });
        }
        // Connect to back and start renderer
        if (!init.args["back-only"]) {
            console.log("connecting to back " + state.backHost.href);

            const waitForConnection = async () => {
                while (true) {
                    try {
                        const socket = await SocketClient.connect(WebSocket, state.backHost.href, "exogui-launcher");
                        console.log("Main connection established to backend");
                        return socket;
                    } catch (error) {
                        console.log("Main connection failed to backend, waiting 1 seconds...");
                        await new Promise<void>(resolve => setTimeout(resolve, 1000));
                    }
                }
            };

            const socket = await waitForConnection();
            state.socket.setSocket(socket);
            state.socket.killOnDisconnect = true;

            // Handle quit signal from backend
            state.socket.register(BackOut.QUIT, () => {
                state.isQuitting = true;
                app.quit();
            });

            const mainData = await state.socket.request(BackIn.GET_MAIN_INIT_DATA);
            state.preferences = mainData.preferences;
            state.config = mainData.config;

            app.whenReady().then(() => {
                state.socket.send(BackIn.SET_LOCALE, app.getLocale().toLowerCase());
                createMainWindow();
            });
        }
    }

    function onAppReady(): void {
        if (!session.defaultSession) {
            throw new Error("Default session is missing!");
        }
        // Reject all permission requests since we don't need any permissions.
        session.defaultSession.setPermissionRequestHandler((_, __, callback) =>
            callback(false)
        );
        // Ignore proxy settings with chromium APIs (makes WebSockets not close when the Redirector changes proxy settings)
        session.defaultSession.setProxy({
            pacScript: "",
            proxyRules: "",
            proxyBypassRules: "",
        });
    }

    function onAppWindowAllClosed(): void {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== "darwin") {
            app.quit();
        }
    }

    function onAppWillQuit(event: Electron.Event): void {
        if (!init.args["connect-remote"] && !state.isQuitting) {
            // (Local back)
            state.socket.send(BackIn.QUIT);
            event.preventDefault();
        }
    }

    function onAppWebContentsCreated(
        _event: Electron.Event,
        webContents: Electron.WebContents
    ): void {
        // Open links to web pages in the OS-es default browser
        // (instead of navigating to it with the electron window that opened it)
        webContents.on("will-navigate", onNewPage);
        webContents.setWindowOpenHandler((details) => {
            shell.openExternal(details.url);
            return { action: "deny" };
        });

        function onNewPage(event: Electron.Event, navigationUrl: string): void {
            event.preventDefault();
            shell.openExternal(navigationUrl);
        }
    }

    function onAppActivate(): void {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (!state.window) {
            createMainWindow();
        }
    }

    function onInit(event: IpcMainEvent) {
        const data: InitRendererData = {
            isBackRemote: !!init.args["connect-remote"],
            installed: !!state._installed,
            version: state._version,
            host: state.backHost.href,
            secret: state._secret,
        };
        event.returnValue = data;
    }

    function getInitialWindowSize(): IAppPreferencesDataMainWindow {
        if (!state.preferences) {
            throw new Error(
                "Preferences must be set before you can open a window."
            );
        }
        if (!state.config) {
            throw new Error(
                "Configs must be set before you can open a window."
            );
        }
        if (
            process.env.SteamDeck &&
            process.env.XDG_CURRENT_DESKTOP === "gamescope"
        ) {
            console.log("Running via deck, forcing 1280x800 resolution");
            return {
                width: 1280,
                height: 800,
                x: 0,
                y: 0,
                maximized: false,
            };
        } else {
            const mainScreen = screen.getPrimaryDisplay();
            const { workAreaSize } = mainScreen;
            const defaultSize = {
                width: Math.min(workAreaSize.width, 1280),
                height: Math.min(workAreaSize.height, 800),
            };
            const mw = state.preferences.mainWindow;
            let width: number = mw.width ? mw.width : defaultSize.width;
            let height: number = mw.height ? mw.height : defaultSize.height;
            if (mw.width && mw.height && !state.config.useCustomTitlebar) {
                width += 8; // Add the width of the window-grab-things,
                height += 8; // they are 4 pixels wide each (at least for me @TBubba)
            }
            return {
                width,
                height,
                x: state.preferences.mainWindow.x,
                y: state.preferences.mainWindow.y,
                maximized: state.preferences.mainWindow.maximized,
            };
        }
    }

    function createMainWindow(): BrowserWindow {
        if (!state.preferences) {
            throw new Error(
                "Preferences must be set before you can open a window."
            );
        }
        if (!state.config) {
            throw new Error(
                "Configs must be set before you can open a window."
            );
        }
        // Create the browser window.
        const mw = getInitialWindowSize();

        remoteMain.initialize();
        const window = new BrowserWindow({
            title: APP_TITLE,
            x: mw.x,
            y: mw.y,
            width: mw.width,
            height: mw.height,
            frame: !state.config.useCustomTitlebar,
            icon: path.join(__dirname, "../window/images/icon.png"),
            webPreferences: {
                preload: path.resolve(__dirname, "./MainWindowPreload.js"),
                nodeIntegration: true,
                contextIsolation: false,
            },
        });
        remoteMain.enable(window.webContents);
        // Remove the menu bar
        window.setMenuBarVisibility(false);
        // and load the index.html of the app.
        window.loadFile(path.join(__dirname, "../window/renderer.html"));
        // Open the DevTools. Don't open if using a remote debugger (like vscode)
        if (Util.isDev && !process.env.REMOTE_DEBUG) {
            window.webContents.openDevTools();
        }
        // Maximize window
        if (mw.maximized) {
            window.maximize();
        }

        window.on("move", () => {
            if (!window) {
                throw new Error();
            }
            const pos = window.getPosition();
            const isMaximized = window.isMaximized();
            window.webContents.send(
                WindowIPC.WINDOW_MOVE,
                pos[0],
                pos[1],
                isMaximized
            );
        });
        // Replay window's move event to the renderer
        window.on("resize", () => {
            if (!window) {
                throw new Error();
            }
            const size = window.getSize();
            const isMaximized = window.isMaximized();
            window.webContents.send(
                WindowIPC.WINDOW_RESIZE,
                size[0],
                size[1],
                isMaximized
            );
        });
        // Derefence window when closed
        window.on("closed", () => {
            if (state.window === window) {
                state.window = undefined;
            }
        });
        return window;
    }
}
