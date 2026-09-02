import * as path from "path";
import * as remote from "@electron/remote";
import * as fs from "fs";
import store from "@renderer/redux/store";
import { updateGame } from "@renderer/redux/gamesSlice";
import { IGameCollection, IGameInfo } from "@shared/game/interfaces";
import { fixSlashes, removeFileExtension, removeLowestDirectory } from "@shared/Util";
import { updateFavoriteField, updateInstalledField } from "@renderer/file/PlatformFile";
import { DirectoryWatcher, watchDirectory } from "./watchDirectory";

export function createGamesWatcher(platformCollection: IGameCollection) {
    const firstValidGame = platformCollection.games.find((g) => !!g.rootFolder);
    const gamesRelativePath = removeLowestDirectory(
        firstValidGame?.rootFolder ?? "",
        2
    );

    if (!gamesRelativePath) {
        return undefined;
    }

    const gamesAbsolutePath = path.join(
        window.External.config.fullExodosPath,
        gamesRelativePath
    );
    return createWatcher(gamesAbsolutePath);
}

export function getGameByTitle(title: string) {
    const state = store.getState().gamesState;
    const game = state.games.find((g) => {
        const gameTitle = removeFileExtension(path.basename(fixSlashes(g.applicationPath)));
        return gameTitle === title;
    });
    return game;
}

export function getGameByDirectory(gamePath: string) {
    const state = store.getState().gamesState;
    const dirname = path.basename(gamePath);

    // Find matching game, if exists
    return state.games.find((game) => {
        return fixSlashes(game.rootFolder).toLowerCase().endsWith(`/${dirname.toLowerCase()}`);
    });
}

function createWatcher(folder: string): DirectoryWatcher {
    console.log(`Initializing installed games watcher with ${folder} path...`);

    return watchDirectory(
        folder,
        {
            onAddDir: (gameDataPath) => {
                console.debug(`Game ${gameDataPath} added.`);
                const game = getGameByDirectory(gameDataPath);
                if (game) {
                    store.dispatch(
                        updateGame({
                            game: {
                                ...game,
                                installed: true,
                            },
                        })
                    );
                    const platformFilePath = path.join(
                        window.External.config.fullExodosPath,
                        window.External.config.data.platformFolderPath,
                        `${game.library}.xml`
                    );
                    updateInstalledField(platformFilePath, game.id, true);
                }
            },
            onRemoveDir: (gameDataPath) => {
                console.debug(`Game ${gameDataPath} has been removed.`);
                const game = getGameByDirectory(gameDataPath);
                if (game) {
                    store.dispatch(
                        updateGame({
                            game: {
                                ...game,
                                installed: false,
                            },
                        })
                    );
                    const platformFilePath = path.join(
                        window.External.config.fullExodosPath,
                        window.External.config.data.platformFolderPath,
                        `${game.library}.xml`
                    );
                    updateInstalledField(platformFilePath, game.id, false);
                }
            },
        },
        {
            ignore: (name) => /^DOWNLOAD$/i.test(name),
            strategy: process.platform === "darwin" ? "poll" : "native",
        }
    );
}

export function toggleGameFavorite(game: IGameInfo) {
    const newValue = !game.favorite;
    store.dispatch(updateGame({ game: { ...game, favorite: newValue } }));
    const platformFilePath = path.join(
        window.External.config.fullExodosPath,
        window.External.config.data.platformFolderPath,
        `${game.library}.xml`
    );
    updateFavoriteField(platformFilePath, game.id, newValue);
}

export function openGameConfigDirectory(game: IGameInfo) {
    const gameConfigPath = path.dirname(
        path.join(
            window.External.config.fullExodosPath,
            fixSlashes(game.applicationPath)
        )
    );
    const configPathExists = fs.existsSync(gameConfigPath);

    if (!configPathExists) {
        alert("Failed to find game config folder on disk?");
        return;
    }
    remote.shell.openPath(gameConfigPath);
}
