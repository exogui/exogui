import * as remoteMain from "@electron/remote/main";
import { describeSocketError, SocketClient } from "@shared/back/SocketClient";
import {
    BackIn,
    BackInitArgs,
    BackOut
} from "@shared/back/types";
import { IAppConfigData } from "@shared/config/interfaces";
import { APP_TITLE } from "@shared/constants";
import { WindowIPC, UpdaterIPC } from "@shared/interfaces";
import { InitRendererChannel, InitRendererData } from "@shared/IPC";
import {
    IAppPreferencesData,
    IAppPreferencesDataMainWindow,
} from "@shared/preferences/interfaces";
import { getResourcesPath } from "@shared/ResourcePath";
import { createErrorProxy } from "@shared/Util";
import { ChildProcess, fork } from "child_process";
import {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    IpcMainEvent,
    nativeImage,
    screen,
    session,
    shell
} from "electron";
import * as path from "path";
import * as WebSocket from "ws";
import { OnlineUpdater } from "./OnlineUpdater";
import {
    attachWindowDiagnostics,
    initRendererDiagnostics,
    shutdownRendererDiagnostics,
} from "./RendererDiagnostics";
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
    socket: SocketClient<WebSocket>;
    backProc?: ChildProcess;
    _sentLocaleCode: boolean;
    /** If the main is about to quit. */
    isQuitting: boolean;
    /** If the back has been asked to quit, so its exit is expected rather than a crash. */
    expectBackExit: boolean;
    /** Path of the folder containing the config and preferences files. */
    mainFolderPath: string;
    /** Online updater instance */
    onlineUpdater?: OnlineUpdater;
};

export function main(init: Init): void {
    const diagnosticsEnabled = !!init.args.diagnostics;
    /** Startup snapshot of the backend config. Not kept in sync after startup —
     *  read only by `createMainWindow` (initial + macOS dock-activate) and the
     *  `OnlineUpdater` constructor, both effectively startup-time. */
    let startupConfig: IAppConfigData | undefined;
    const state: MainState = {
        window: undefined,
        _installed: undefined,
        backHost: new URL("ws://127.0.0.1"),
        _secret: "",
        /** Version of the launcher (timestamp of when it was built). Negative value if not found or not yet loaded. */
        _version: -2,
        preferences: undefined,
        socket: new SocketClient(WebSocket),
        backProc: undefined,
        _sentLocaleCode: false,
        isQuitting: false,
        expectBackExit: false,
        mainFolderPath: createErrorProxy("mainFolderPath"),
    };

    startup().catch((error) => {
        console.error("Startup failed:", error);
    });

    async function startup() {
        // Disable sandbox for Linux (required for AppImage and some distros)
        if (process.platform === "linux") {
            app.commandLine.appendSwitch("no-sandbox");
            app.commandLine.appendSwitch("disable-dev-shm-usage");
            if (process.env.XDG_CURRENT_DESKTOP === "gamescope") {
                // In gamescope (Steam Deck Game Mode), force pure X11 mode.
                // Without this, Electron operates in a hybrid X11+Wayland mode
                // and the Steam OSK delivers each keypress twice (once via X11
                // uinput, once via the Wayland text-input protocol).
                app.commandLine.appendSwitch("ozone-platform", "x11");
            } else {
                // Enable Wayland window decorations (helps with icon display)
                app.commandLine.appendSwitch("enable-features", "WaylandWindowDecorations");
            }
            // Set WM_CLASS for proper Wayland icon matching with .desktop file
            app.commandLine.appendSwitch("class", "exogui");
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

        if (diagnosticsEnabled) {
            initRendererDiagnostics(state.mainFolderPath);
        }

        // Start back process
        if (!init.args["connect-remote"]) {
            await new Promise<void>((resolve, reject) => {
                state.backProc = fork(
                    path.join(__dirname, "../back/index.js"),
                    undefined,
                    { detached: true }
                );
                state.backProc.on("error", (error) => {
                    console.error("Back process error:", error);
                });
                state.backProc.on("exit", (code, signal) => {
                    onBackProcExit(code, signal);
                    reject(
                        new Error(
                            `Back process exited during startup (code=${code}, signal=${signal}).`
                        )
                    );
                });
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
                    basePath: getResourcesPath(app, Util.isDev),
                    acceptRemote: !!init.args["host-remote"],
                    diagnostics: diagnosticsEnabled,
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
                        console.log(`Main connection failed to backend: ${describeSocketError(error)}. Retrying in 1s.`);
                        await new Promise<void>(resolve => setTimeout(resolve, 1000));
                    }
                }
            };

            const socket = await waitForConnection();
            // Without these the client has nothing to dial on a drop, and every disconnect ends
            // in "No client url stored, cannot reconnect" with the window left pointing at a
            // backend that is no longer there.
            state.socket.url = state.backHost.href;
            state.socket.secret = "exogui-launcher";
            state.socket.setSocket(socket);

            // Handle quit signal from backend
            state.socket.register(BackOut.QUIT, () => {
                state.expectBackExit = true;
                state.isQuitting = true;
                app.quit();
            });

            const mainData = await state.socket.request(BackIn.GET_MAIN_INIT_DATA);
            state.preferences = mainData.preferences;
            startupConfig = mainData.config;

            // Initialize online updater
            state.onlineUpdater = new OnlineUpdater({
                enabled: startupConfig.enableOnlineUpdate,
                checkOnStartup: true,
                autoDownload: false,
                autoInstallOnQuit: false,
                channel: startupConfig.updateChannel,
            });

            app.whenReady().then(() => {
                // Set app name for Wayland WM_CLASS matching with .desktop file
                app.setName("exogui");

                state.socket.send(BackIn.SET_LOCALE, app.getLocale().toLowerCase());
                const window = createMainWindow(startupConfig!);
                state.window = window;

                // Set window reference for online updater
                if (state.onlineUpdater) {
                    state.onlineUpdater.setMainWindow(window);

                    // Register handlers for updater requests from renderer (direct IPC)
                    ipcMain.on(UpdaterIPC.START_DOWNLOAD, async () => {
                        await state.onlineUpdater?.downloadUpdate();
                    });

                    ipcMain.on(UpdaterIPC.SKIP_UPDATE, () => {
                        state.onlineUpdater?.handleSkipRequest();
                    });

                    ipcMain.on(UpdaterIPC.INSTALL_NOW, () => {
                        state.onlineUpdater?.quitAndInstall();
                    });

                    ipcMain.on(UpdaterIPC.DISMISS_ERROR, () => {
                        state.onlineUpdater?.handleDismissError();
                    });

                    ipcMain.on(UpdaterIPC.CHECK_FOR_UPDATES, async () => {
                        await state.onlineUpdater?.checkForUpdates();
                    });

                    ipcMain.on(UpdaterIPC.UPDATE_CONFIG, (event, data: { enabled?: unknown; channel?: unknown } | undefined) => {
                        state.onlineUpdater?.updateConfig({
                            enabled: !!data?.enabled,
                            channel: data?.channel === "beta" ? "beta" : "stable",
                        });
                    });

                    // Test-only handlers for DeveloperPage
                    ipcMain.on(UpdaterIPC.TEST_UPDATE_AVAILABLE, (event, data) => {
                        window.webContents.send(UpdaterIPC.UPDATE_AVAILABLE, data);
                    });

                    ipcMain.on(UpdaterIPC.TEST_DOWNLOAD_PROGRESS, (event, data) => {
                        window.webContents.send(UpdaterIPC.UPDATE_DOWNLOAD_PROGRESS, data);
                    });

                    ipcMain.on(UpdaterIPC.TEST_DOWNLOADED, (event, data) => {
                        window.webContents.send(UpdaterIPC.UPDATE_DOWNLOADED, data);
                    });

                    ipcMain.on(UpdaterIPC.TEST_ERROR, (event, data) => {
                        window.webContents.send(UpdaterIPC.UPDATE_ERROR, data);
                    });

                    ipcMain.on(UpdaterIPC.TEST_CANCELLED, () => {
                        window.webContents.send(UpdaterIPC.UPDATE_CANCELLED);
                    });

                    // Wait for renderer to signal it's ready before starting updater
                    ipcMain.once(UpdaterIPC.RENDERER_READY, () => {
                        state.onlineUpdater?.start();
                    });
                }
            });
        }
    }

    /**
     * The back process dying is the one failure the window cannot report on its own: the socket
     * just closes and everything the renderer asks for hangs forever. Say what happened, on
     * stdout and to the user, and stop the client from retrying a port nothing is listening on.
     */
    function onBackProcExit(code: number | null, signal: NodeJS.Signals | null): void {
        if (state.isQuitting || state.expectBackExit) {
            console.log(`Back process exited (code=${code}, signal=${signal}).`);
            return;
        }

        console.error(
            `Back process died unexpectedly (code=${code}, signal=${signal}). ` +
        (signal === "SIGKILL"
            ? "SIGKILL usually means the OS killed it - check dmesg/journalctl -k for the OOM killer."
            : "See the output above for what it logged before going.")
        );

        state.socket.allowDeath();
        state.isQuitting = true;

        dialog.showErrorBox(
            `${APP_TITLE} - backend stopped`,
            `The background process exited unexpectedly (code=${code}, signal=${signal}).\n\n` +
        "The launcher cannot continue without it and will now close. Start it from a terminal to see what it logged before it died."
        );

        app.quit();
    }

    function onAppReady(): void {
        if (!session.defaultSession) {
            throw new Error("Default session is missing!");
        }
        remoteMain.initialize();
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
        // Cleanup online updater
        if (state.onlineUpdater) {
            state.onlineUpdater.cleanup();
        }

        if (diagnosticsEnabled) {
            shutdownRendererDiagnostics();
        }

        if (!init.args["connect-remote"] && !state.isQuitting) {
            // (Local back)
            state.expectBackExit = true;
            state.socket.send(BackIn.QUIT);
            event.preventDefault();
            // Backend may die before its BackOut.QUIT message reaches us (race on socket close).
            // Force quit after a grace period so the main process never hangs.
            setTimeout(() => {
                if (!state.isQuitting) {
                    state.isQuitting = true;
                    app.quit();
                }
            }, 3000);
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
        if (!state.window && startupConfig) {
            createMainWindow(startupConfig);
        }
    }

    function onInit(event: IpcMainEvent) {
        const data: InitRendererData = {
            isBackRemote: !!init.args["connect-remote"],
            installed: !!state._installed,
            host: state.backHost.href,
            secret: state._secret,
            version: app.getVersion(),
            onlineUpdateSupported: state.onlineUpdater?.getState().available,
        };
        event.returnValue = data;
    }

    function getInitialWindowSize(config: IAppConfigData): IAppPreferencesDataMainWindow {
        if (!state.preferences) {
            throw new Error(
                "Preferences must be set before you can open a window."
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
            if (mw.width && mw.height && !config.useCustomTitlebar) {
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

    function createMainWindow(config: IAppConfigData): BrowserWindow {
        if (!state.preferences) {
            throw new Error(
                "Preferences must be set before you can open a window."
            );
        }
        // Create the browser window.
        const mw = getInitialWindowSize(config);

        const iconPath = path.join(__dirname, "../window/images/icon.png");
        const icon = nativeImage.createFromPath(iconPath);

        const window = new BrowserWindow({
            title: APP_TITLE,
            x: mw.x,
            y: mw.y,
            width: mw.width,
            height: mw.height,
            frame: !config.useCustomTitlebar,
            icon: icon,
            webPreferences: {
                preload: path.resolve(__dirname, "./MainWindowPreload.js"),
                nodeIntegration: true,
                contextIsolation: false,
                additionalArguments: diagnosticsEnabled
                    ? ["--exogui-diagnostics=true"]
                    : [],
            },
        });
        remoteMain.enable(window.webContents);
        if (diagnosticsEnabled) {
            attachWindowDiagnostics(window);
        }
        // Remove the menu bar
        window.setMenuBarVisibility(false);
        // and load the index.html of the app.
        window.loadFile(path.join(__dirname, "../window/renderer.html"));
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
        // Send maximize/unmaximize events
        window.on("maximize", () => {
            if (!window) {
                throw new Error();
            }
            window.webContents.send(WindowIPC.WINDOW_MAXIMIZE, true);
        });
        window.on("unmaximize", () => {
            if (!window) {
                throw new Error();
            }
            window.webContents.send(WindowIPC.WINDOW_MAXIMIZE, false);
        });
        window.on("blur", () => {
            window.webContents.send(WindowIPC.WINDOW_BLUR);
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
