import { deepCopy, fixSlashes } from "@shared/Util";
import { BackIn, BackInit, BackOut } from "@shared/back/types";
import { overwriteConfigData } from "@shared/config/util";
import { PreferencesFile } from "@shared/preferences/PreferencesFile";
import { defaultPreferencesData, overwritePreferenceData } from "@shared/preferences/util";
import * as path from "path";
import { configFilename, exit, preferencesFilename } from ".";
import { ConfigFile } from "./config/ConfigFile";
import { GameLauncher } from "./game/GameLauncher";
import { BackState } from "./types";
import { difObjects } from "./util/misc";

export function registerRequestCallbacks(state: BackState): void {
    state.socketServer.register(BackIn.KEEP_ALIVE, () => {});

    state.socketServer.register(BackIn.ADD_LOG, (event, log) => {
        const entry: ILogEntry = {
            source: log.source,
            content: log.content,
            timestamp: Date.now(),
        };
        state.logs.push(entry);
    });

    state.socketServer.register(BackIn.INIT_LISTEN, () => {
        const done: BackInit[] = [];

        for (const key in state.init) {
            const init: BackInit = key as any;
            if (state.init[init]) {
                done.push(init);
            } else {
                state.initEmitter.once(init, () => {
                    state.socketServer.broadcast(BackOut.INIT_EVENT, [init]);
                });
            }
        }

        return done;
    });

    state.socketServer.register(BackIn.SET_LOCALE, (event, localeCode) => {
        state.localeCode = localeCode;
        state.socketServer.broadcastExcept(event.client, BackOut.LOCALE_UPDATE, localeCode);
    });

    state.socketServer.register(BackIn.GET_EXEC, () => {
        return state.execMappings;
    });

    state.socketServer.register(BackIn.GET_MAIN_INIT_DATA, () => {
        return {
            preferences: state.preferences,
            config: state.config,
        };
    });

    state.socketServer.register(BackIn.GET_RENDERER_INIT_DATA, () => {
        return {
            preferences: state.preferences,
            config: state.config,
            commandMappings: state.commandMappings,
            fileServerPort: state.fileServer?.port ?? -1,
            log: state.logs,
            themes: state.themeFiles.map((theme) => ({
                entryPath: theme.entryPath,
                meta: theme.meta,
            })),
            playlists: state.init[BackInit.PLAYLISTS]
                ? state.playlistManager.playlists
                : undefined,
            localeCode: state.localeCode,
            vlcAvailable: state.vlcPlayer !== undefined
        };
    });

    state.socketServer.register(BackIn.LAUNCH_COMMAND, async (event, filePath) => {
        const appPath = fixSlashes(
            path.join(
                path.resolve(state.config.exodosPath),
                filePath
            )
        );
        GameLauncher.launchCommand(
            appPath,
            "",
            state.commandMappings
        );
    });

    state.socketServer.register(BackIn.LAUNCH_GAME, async (event, game, addApps) => {
        GameLauncher.launchGame({
            game,
            addApps,
            fpPath: path.resolve(state.config.exodosPath),
            native: state.config.nativePlatforms.some(
                (p) => p === game.platform
            ),
            mappings: state.commandMappings,
            execMappings: state.execMappings,
            openDialog: state.socketServer.showMessageBoxFactory(state, event.client),
            openExternal: state.socketServer.openExternal(event.client),
        });
    });

    state.socketServer.register(BackIn.LAUNCH_GAME_SETUP, async (event, game, addApps) => {
        GameLauncher.launchGameSetup({
            game,
            addApps,
            fpPath: path.resolve(state.config.exodosPath),
            native: state.config.nativePlatforms.some(
                (p) => p === game.platform
            ),
            mappings: state.commandMappings,
            execMappings: state.execMappings,
            openDialog: state.socketServer.showMessageBoxFactory(state, event.client),
            openExternal: state.socketServer.openExternal(event.client),
        });
    });

    state.socketServer.register(BackIn.LAUNCH_ADDAPP, async (event, game, addApp) => {
        GameLauncher.launchAdditionalApplication({
            addApp,
            fpPath: path.resolve(state.config.exodosPath),
            native:
                (game &&
                    state.config.nativePlatforms.some(
                        (p) => p === game.platform
                    )) ||
                false,
            mappings: state.commandMappings,
            execMappings: state.execMappings,
            openDialog: state.socketServer.showMessageBoxFactory(state, event.client),
            openExternal: state.socketServer.openExternal(event.client),
        });
    });

    state.socketServer.register(BackIn.PLAY_AUDIO_FILE, async (event, filePath) => {
        try {
            if (state.preferences.gameMusicPlay) {
                console.log(`Playing: ${filePath}`);
                await state.vlcPlayer?.play(filePath);
            } else {
                state.vlcPlayer?.setFile(filePath);
            }
        } catch (err) {
            log("VLC", `${err}`);
            console.log(err);
        }
    });

    state.socketServer.register(BackIn.TOGGLE_MUSIC, async (event, newState) => {
        try {
            if (newState) {
                await state.vlcPlayer?.resume();
            } else {
                await state.vlcPlayer?.stop();
            }
        } catch (err) {
            log("VLC", `${err}`);
            console.log(err);
        }
    });

    state.socketServer.register(BackIn.SET_VOLUME, async (event, volume) => {
        try {
            await state.vlcPlayer?.setVol(volume);
        } catch (err) {
            log("VLC", `${err}`);
            console.log(err);
        }
    });

    state.socketServer.register(BackIn.UPDATE_CONFIG, async (event, data) => {
        const newConfig = deepCopy(state.config);
        overwriteConfigData(newConfig, data);

        try {
            await ConfigFile.saveFile(
                path.join(state.configFolder, configFilename),
                newConfig
            );
        } catch (error) {
            log("Launcher", error?.toString() ?? "");
        }
    });

    state.socketServer.register(BackIn.UPDATE_PREFERENCES, async (event, data) => {
        const dif = difObjects(
            defaultPreferencesData,
            state.preferences,
            data
        );
        if (dif) {
            overwritePreferenceData(state.preferences, dif);
            await PreferencesFile.saveFile(
                path.join(state.configFolder, preferencesFilename),
                state.preferences
            );
        }
        state.socketServer.broadcast(BackOut.UPDATE_PREFERENCES_RESPONSE, state.preferences);
    });

    state.socketServer.register(BackIn.GET_PLAYLISTS, () => {
        return state.playlistManager.playlists;
    });

    state.socketServer.register(BackIn.QUIT, () => {
        exit();
    });

    state.socketServer.register(BackIn.NOTIFY_UPDATE_AVAILABLE, (event, data) => {
        state.socketServer.broadcast(BackOut.UPDATE_AVAILABLE, data);
    });

    state.socketServer.register(BackIn.NOTIFY_UPDATE_DOWNLOAD_PROGRESS, (event, data) => {
        state.socketServer.broadcast(BackOut.UPDATE_DOWNLOAD_PROGRESS, data);
    });

    state.socketServer.register(BackIn.NOTIFY_UPDATE_DOWNLOADED, (event, data) => {
        state.socketServer.broadcast(BackOut.UPDATE_DOWNLOADED, data);
    });

    state.socketServer.register(BackIn.NOTIFY_UPDATE_ERROR, (event, data) => {
        state.socketServer.broadcast(BackOut.UPDATE_ERROR, data);
    });

    state.socketServer.register(BackIn.NOTIFY_UPDATE_CANCELLED, (event) => {
        state.socketServer.broadcast(BackOut.UPDATE_CANCELLED);
    });

    state.socketServer.register(BackIn.UPDATE_START_DOWNLOAD, (event) => {
        state.socketServer.broadcast(BackOut.UPDATER_START_DOWNLOAD_REQUEST);
    });

    state.socketServer.register(BackIn.UPDATE_CANCEL_DOWNLOAD, (event) => {
        state.socketServer.broadcast(BackOut.UPDATER_CANCEL_DOWNLOAD_REQUEST);
    });

    state.socketServer.register(BackIn.UPDATE_SKIP, (event) => {
        state.socketServer.broadcast(BackOut.UPDATER_SKIP_REQUEST);
    });

    state.socketServer.register(BackIn.UPDATE_INSTALL_NOW, (event) => {
        state.socketServer.broadcast(BackOut.UPDATER_INSTALL_NOW_REQUEST);
    });

    state.socketServer.register(BackIn.UPDATE_DISMISS_ERROR, (event) => {
        state.socketServer.broadcast(BackOut.UPDATER_DISMISS_ERROR_REQUEST);
    });

    state.socketServer.register(BackIn.CHECK_FOR_UPDATES, (event) => {
        state.socketServer.broadcast(BackOut.UPDATER_CHECK_REQUEST);
    });
}