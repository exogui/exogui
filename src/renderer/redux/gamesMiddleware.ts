import { isAnyOf } from "@reduxjs/toolkit";
import { readPlatformsFile } from "@renderer/file/PlatformFile";
import { formatPlatformFileData } from "@renderer/util/LaunchBoxHelper";
import { GameParser } from "@shared/game/GameParser";
import * as fs from "fs";
import * as fsasync from "fs/promises";
import * as path from "path";
import { setGames, setLibraries } from "./gamesSlice";
import {
    initializeLoading,
    setPlatformsLoaded,
    setPlatformLoadingProgress,
    setLoadingError,
} from "./loadingSlice";
import { startAppListening } from "./listenerMiddleware";
import { initializeViews } from "./searchSlice";
import { IGameCollection } from "@shared/game/interfaces";
import { GameCollection } from "@shared/game/GameCollection";
import {
    createVideosWatcher,
    loadPlatformImages,
    loadPlatformVideos,
    mapGamesMedia,
} from "@renderer/util/media";
import { createManualsWatcher } from "@renderer/util/addApps";
import { createGamesWatcher } from "@renderer/util/games";
import { XMLParser } from "fast-xml-parser";
import {
    DefaultPlatformOptions,
    platformOptions,
} from "@renderer/util/PlatformOptions";

export function addGamesMiddleware() {
    startAppListening({
        matcher: isAnyOf(initializeLoading),
        effect: async (_action, listenerApi) => {
            try {
                const startTime = Date.now();
                console.log("[PERF] ========== GAME LOADING START ==========");
                const libraries: string[] = [];
                const collection: GameCollection = new GameCollection();

                const platformsPath = path.join(
                    window.External.config.fullExodosPath,
                    window.External.config.data.platformFolderPath
                );

                const readPlatformsStart = Date.now();
                const { platforms } = await readPlatformsFile(
                    path.join(platformsPath, "../Platforms.xml")
                );
                console.log(`[PERF] Read Platforms.xml (${platforms.length} platforms): ${Date.now() - readPlatformsStart}ms`);

                const totalPlatforms = platforms.length;
                for (let i = 0; i < platforms.length; i++) {
                    const platform = platforms[i];
                    listenerApi.dispatch(setPlatformLoadingProgress({
                        currentIndex: i + 1,
                        total: totalPlatforms,
                        currentName: platform,
                    }));
                    try {
                        const platformCollection = await loadPlatform(
                            platform,
                            platformsPath
                        );
                        if (platformCollection.games.length > 0) {
                            libraries.push(platform);
                        }
                        collection.push(platformCollection);

                        const optionsForPlatform =
                            platformOptions?.find((p) => p.name === platform) ??
                            DefaultPlatformOptions;
                        if (optionsForPlatform.watchable) {
                            createGamesWatcher(platformCollection);
                            createVideosWatcher(platform);
                            createManualsWatcher(platform);
                        }
                    } catch (err) {
                        console.error(`Failed to load platform ${err}`);
                    }
                }
                console.log(`[PERF] ========== TOTAL GAME LOADING TIME: ${Date.now() - startTime}ms ==========`);
                libraries.sort();
                listenerApi.dispatch(setLibraries(libraries));
                listenerApi.dispatch(initializeViews(libraries));
                listenerApi.dispatch(setGames(collection.forRedux()));
                listenerApi.dispatch(setPlatformsLoaded());
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`Failed to initialize games: ${errorMessage}`);
                listenerApi.dispatch(setLoadingError(errorMessage));
            }
        },
    });
}

async function loadPlatform(platform: string, platformsPath: string) {
    const platformStartTime = Date.now();
    console.log(`[PERF] Loading platform ${platform} from ${platformsPath} - START`);

    try {
        const findFileStart = Date.now();
        const platformFileCaseInsensitive =
            await findPlatformFileCaseInsensitive(
                `${platform}.xml`,
                platformsPath
            );
        const platformFile = path.join(
            platformsPath,
            platformFileCaseInsensitive
        );
        console.log(`[PERF] ${platform} - Find file: ${Date.now() - findFileStart}ms`);

        if ((await fs.promises.stat(platformFile)).isFile()) {
            console.debug(`Platform file found: ${platformFile}`);

            const readFileStart = Date.now();
            const content = await fs.promises.readFile(platformFile, {
                encoding: "utf-8",
            });
            console.log(`[PERF] ${platform} - Read XML file (${content.length} bytes): ${Date.now() - readFileStart}ms`);

            const parseXmlStart = Date.now();
            const parser = new XMLParser({
                numberParseOptions: {
                    leadingZeros: true,
                    eNotation: true,
                    hex: false,
                },
                tagValueProcessor: (
                    tagName,
                    tagValue,
                    _jPath,
                    _hasAttributes,
                    _isLeafNode
                ) => {
                    if (tagName === "CommandLine") {
                        return null;
                    }
                    return tagValue;
                },
            });
            const data: any | undefined = parser.parse(content.toString());
            console.log(`[PERF] ${platform} - Parse XML: ${Date.now() - parseXmlStart}ms`);

            if (!formatPlatformFileData(data)) {
                throw new Error(`Failed to parse XML file: ${platformFile}`);
            }

            const imagesStart = Date.now();
            const images = await loadPlatformImages(platform);
            console.log(`[PERF] ${platform} - Load images: ${Date.now() - imagesStart}ms`);

            const videosStart = Date.now();
            const videos = loadPlatformVideos(platform);
            console.log(`[PERF] ${platform} - Load videos: ${Date.now() - videosStart}ms`);

            const parseGamesStart = Date.now();
            const platformCollection = GameParser.parse(
                data,
                platform,
                window.External.config.fullExodosPath
            );
            console.log(`[PERF] ${platform} - Parse games (${platformCollection.games.length} games): ${Date.now() - parseGamesStart}ms`);

            const mapMediaStart = Date.now();
            for (const game of platformCollection.games) {
                mapGamesMedia(game, images, videos);
            }
            console.log(`[PERF] ${platform} - Map media: ${Date.now() - mapMediaStart}ms`);

            console.log(`[PERF] ${platform} - TOTAL: ${Date.now() - platformStartTime}ms`);

            return platformCollection;
        } else {
            console.log(`Platform file not found: ${platformFile}`);
        }
    } catch (error) {
        console.error(`Failed to load Platform "${platform}": ${error}`);
    }

    return { games: [], addApps: [] } as IGameCollection;
}

// Of course there is a problem with casing in some platform files.
// We need to list all of the files directory and search for the hits
// manually.
const findPlatformFileCaseInsensitive = async (
    filename: string,
    path: string
): Promise<string> => {
    console.debug(`Checking existence of platform ${filename} xml file..`);

    const lowerCasedFilename = filename.toLowerCase();
    const directoryContent = await fsasync.readdir(path);
    const platformXmlFile = directoryContent.find(
        (f) => f.toLowerCase() === lowerCasedFilename
    );
    if (!platformXmlFile)
        throw new Error(
            `Platform file ${filename} doesn't exist in ${path} directory.`
        );
    return platformXmlFile;
};

export type ErrorCopy = {
    columnNumber?: number;
    fileName?: string;
    lineNumber?: number;
    message: string;
    name: string;
    stack?: string;
};

export type LoadPlatformError = ErrorCopy & {
    /** File path of the platform file the error is related to. */
    filePath: string;
};
