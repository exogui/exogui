import { deepCopy, extractTitleFromMediaPath, fixSlashes, getRelativePath, removeFileExtension } from "@shared/Util";
import {
    CategoryImageIndex,
    GameImages,
    GameImagesCollection,
    GameMusicCollection,
    GameVideosCollection,
    IGameInfo,
} from "@shared/game/interfaces";
import * as fs from "fs";
import * as path from "path";
import { IFileInfo } from "@shared/platform/interfaces";
import * as chokidar from "chokidar";
import { updateGame } from "@renderer/redux/gamesSlice";
import { getGameByTitle } from "./games";
import store from "@renderer/redux/store";

export function loadPlatformVideos(platform: string): GameVideosCollection {
    const videosPath = getPlatformVideosPath(platform);
    const videos: GameVideosCollection = {};

    if (fs.existsSync(videosPath)) {
        const files = fs
        .readdirSync(videosPath)
        .filter((f) => f.endsWith(".mp4"));
        for (const s of files) {
            videos[s.split(".mp4")[0]] = encodeURIComponent(s);
        }
    }

    return videos;
}

const thumbnailPreference = [
    "Box - Front",
    "Box - Front - Reconstructed",
    "Fanart - Box - Front",
    "Clear Logo",
    "Screenshot - Game Title",
];

// VIDEOS WATCHER
// FOR EVERY dir in the Videos/
//      watch for the .mp4 files
//      do what is in the findVideo
//      call redux action for adding video
//
// comments, probably findVideo doesn't need to be done as initial run of the chokidar runner will iterate over files
// but we want to do at all at once for initial so if there is no way for that then left it and in chokidar do not do
// initial reading
//
// Instead of first load all videos and then in mapGamesMedia map it to game we may search for the video when game is initialized
// and after is installed, but for that we need to ensure that on installation video is extracted first and then game

// / Search for the medias for the game in the images and videos collection and fill this info to the game metadata object
function getGameTitleForVideo(game: IGameInfo) {
    return removeFileExtension(path.basename(fixSlashes(game.applicationPath)));
}

export function mapGameVideo(game: IGameInfo, videos: GameVideosCollection) {
    const gameName = getGameTitleForVideo(game);
    try {
        if (videos[gameName]) {
            game.media.video = `Videos/${game.platform}/${videos[gameName]}`;
        }
    } catch {
        // Ignore, files don't exist if path isn't forming
    }
}

/**
 * Assigns every game its images out of the platform's image collection.
 *
 * Works on the whole platform at once because the loose fallback has to know which files
 * another game already claimed by exact name, and which loose keys more than one game
 * answers to. eXoDOS disambiguates same-titled games by appending the game's GUID to the
 * image filename ("Creation-01.png" vs "Creation.408653ba-...-01.png"), so a game that has
 * any GUID-named image is never allowed to fall back to the bare title - those files
 * belong to its same-named sibling.
 */
export function assignGameImages(
    games: IGameInfo[],
    images: GameImagesCollection
) {
    const categories = Object.keys(images);
    const claimed = new Set<string>();
    const looseKeyOwners = countLooseKeyOwners(games);
    const pendingCategories = new Map<IGameInfo, string[]>();

    for (const game of games) {
        const qualified = `${game.title}.${game.id}`;
        const keys = [sanitizeTitleForFilename(qualified)];
        if (!hasImagesForKey(images, categories, keys[0])) {
            keys.push(sanitizeTitleForFilename(game.title));
        }

        const pending: string[] = [];
        for (const category of categories) {
            const found = findPreciseImages(images[category], keys);
            if (found) {
                assignCategoryImages(game, category, found, claimed);
            } else {
                pending.push(category);
            }
        }
        pendingCategories.set(game, pending);
    }

    for (const game of games) {
        const qualified = `${game.title}.${game.id}`;
        const keys = [
            convertToGameTitleIndexKeepingYear(qualified),
            convertToGameTitleIndex(qualified),
            convertToGameTitleIndexKeepingYear(game.title),
            convertToGameTitleIndex(game.title),
        ].filter((key) => key && looseKeyOwners.get(key) === 1);

        for (const category of pendingCategories.get(game) ?? []) {
            const found = findLooseImages(images, category, keys, claimed);
            if (found) {
                assignCategoryImages(game, category, found, claimed);
            }
        }
    }

    for (const game of games) {
        for (const preference of thumbnailPreference) {
            const thumbnail = game.media.images[preference]?.[0];
            if (thumbnail) {
                game.thumbnailPath = `Images/${game.platform}/${fixSlashes(
                    thumbnail
                )}`;
                break;
            }
        }
    }
}

function assignCategoryImages(
    game: IGameInfo,
    category: string,
    imagePaths: string[],
    claimed: Set<string>
) {
    game.media.images[category] = imagePaths;
    for (const imagePath of imagePaths) {
        claimed.add(`${category}/${imagePath}`);
    }
}

function countLooseKeyOwners(games: IGameInfo[]): Map<string, number> {
    const owners = new Map<string, Set<string>>();
    for (const game of games) {
        for (const title of [game.title, `${game.title}.${game.id}`]) {
            const keys = [
                convertToGameTitleIndexKeepingYear(title),
                convertToGameTitleIndex(title),
            ];
            for (const key of new Set(keys)) {
                if (!key) continue;
                const gameIds = owners.get(key) ?? new Set<string>();
                gameIds.add(game.id);
                owners.set(key, gameIds);
            }
        }
    }
    return new Map(
        [...owners].map(([key, gameIds]) => [key, gameIds.size])
    );
}

function hasImagesForKey(
    images: GameImagesCollection,
    categories: string[],
    key: string
): boolean {
    return categories.some(
        (category) =>
            images[category].exact[key] ||
            images[category].insensitive[key.toUpperCase()]
    );
}

function findPreciseImages(
    index: CategoryImageIndex,
    keys: string[]
): string[] | null {
    for (const key of keys) {
        const found = index.exact[key] ?? index.insensitive[key.toUpperCase()];
        if (found) return found;
    }
    return null;
}

function findLooseImages(
    images: GameImagesCollection,
    category: string,
    keys: string[],
    claimed: Set<string>
): string[] | null {
    for (const key of keys) {
        const found = images[category].loose[key]?.filter(
            (imagePath) => !claimed.has(`${category}/${imagePath}`)
        );
        if (found?.length) return found;
    }
    return null;
}

// Finds a list of all game images, returned in a map where the key is the type of image, and the value is an array of filenames
export async function loadPlatformImages(
    platform: string
): Promise<GameImagesCollection> {
    const platformImagesPath = path.join(
        window.External.config.fullExodosPath,
        window.External.config.data.imageFolderPath,
        platform
    );
    const collection: GameImagesCollection = {};

    if (fs.existsSync(platformImagesPath)) {
        const rootFolders = await fs.promises.readdir(platformImagesPath, {
            withFileTypes: true,
        });
        for (const dir of rootFolders.filter((f) => f.isDirectory())) {
            const index = createCategoryImageIndex();
            collection[dir.name] = index;

            const folderPath = path.join(platformImagesPath, dir.name);

            for (const fileInfo of walkSync(folderPath)) {
                try {
                    indexImage(
                        index,
                        fileInfo.filename,
                        createImagePath(platformImagesPath, fileInfo)
                    );
                } catch (err) {
                    console.error(
                        `Error while processing ${fileInfo.filename} file. Skipping. Error: ${err}`
                    );
                }
            }
        }
    }

    return collection;
}

function createImagePath(platformImagePath: string, fileInfo: IFileInfo) {
    return path.relative(
        platformImagePath,
        path.join(
            path.dirname(fileInfo.path),
            encodeURIComponent(fileInfo.filename)
        )
    );
}

export function createCategoryImageIndex(): CategoryImageIndex {
    return { exact: {}, insensitive: {}, loose: {} };
}

export function indexImage(
    index: CategoryImageIndex,
    filename: string,
    imagePath: string
) {
    const titleFromFilename = getGameTitleIndexFromFilename(filename);
    if (!titleFromFilename) return;

    const sanitized = sanitizeTitleForFilename(titleFromFilename);
    pushImage(index.exact, sanitized, imagePath);
    pushImage(index.insensitive, sanitized.toUpperCase(), imagePath);

    const looseKeys = new Set([
        convertToGameTitleIndexKeepingYear(titleFromFilename),
        convertToGameTitleIndex(titleFromFilename),
    ]);
    for (const looseKey of looseKeys) {
        pushImage(index.loose, looseKey, imagePath);
    }
}

function pushImage(index: GameImages, key: string, imagePath: string) {
    if (!key) return;
    if (!index[key]) {
        index[key] = [];
    }
    index[key].push(imagePath);
}

export function getGameTitleIndexFromFilename(filename: string): string | null {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
    const nameWithoutNum = nameWithoutExt.replace(/-\d{2,}$/, "");
    const title = nameWithoutNum.trim();
    return title || null;
}

// Mirrors how LaunchBox writes image filenames: characters Windows forbids in a filename
// (plus the apostrophe) become an underscore, everything else is kept verbatim.
export function sanitizeTitleForFilename(title: string): string {
    return title
    .replace(/[\\/:*?"<>|']/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

export function convertToGameTitleIndexKeepingYear(title: string): string {
    return title
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function convertToGameTitleIndex(title: string): string {
    return convertToGameTitleIndexKeepingYear(
        title.replace(/\s*\(\d{4}\)\s*$/, "")
    );
}

export function* walkSync(dir: string): IterableIterator<IFileInfo> {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walkSync(path.join(dir, file.name));
        } else {
            yield {
                filename: file.name,
                path: path.join(dir, file.name),
            };
        }
    }
}

export function createVideosWatcher(platform: string): chokidar.FSWatcher {
    const videosPath = getPlatformVideosPath(platform);
    console.log(
        `Initializing videos watcher for ${platform} path ${videosPath}`
    );

    const watcher = chokidar.watch(videosPath, {
        depth: 0,
        persistent: true,
        followSymlinks: false,
        ignoreInitial: true,
    });

    watcher
    .on("add", (videoPath) => {
        console.debug(`Video ${videoPath} added.`);
        const relativePath = getRelativePath(videoPath, window.External.config.fullExodosPath);
        const title = extractTitleFromMediaPath(videoPath, window.External.config.fullExodosPath);
        if (title) {
            const game = getGameByTitle(title);
            if (game) {
                console.debug(
                    `Found the game for the new video. Updating game ${title}`
                );
                const updatedGame = deepCopy(game);
                updatedGame.media.video = relativePath;
                // HACK: Sometimes extraction of the video is not finished but the view was refreshed and the video doesn't start. Added delay.
                setTimeout(
                    () =>
                        store.dispatch(
                            updateGame({
                                game: updatedGame,
                            })
                        ),
                    2000
                );
            }
        }
    })
    .on("error", (error) => console.log(`Watcher error: ${error}`));

    return watcher;
}

function getPlatformVideosPath(platform: string) {
    return path.join(window.External.config.fullExodosPath, "Videos", platform);
}

const musicExtensions = new Set([".mp3", ".ogg", ".flac", ".wav", ".mod", ".s3m", ".xm", ".m3u"]);

export function loadPlatformMusic(platform: string): GameMusicCollection {
    const musicPath = getPlatformMusicPath(platform);
    const music: GameMusicCollection = {};

    if (fs.existsSync(musicPath)) {
        const files = fs.readdirSync(musicPath).filter((f) =>
            musicExtensions.has(path.extname(f).toLowerCase())
        );
        for (const f of files) {
            music[removeFileExtension(f)] = `Music/${platform}/${f}`;
        }
    }

    return music;
}

export function mapGamesMusic(game: IGameInfo, music: GameMusicCollection): void {
    const gameName = getGameTitleForVideo(game);
    if (music[gameName]) {
        game.musicPath = music[gameName];
    } else if (game.musicPath) {
        const absolutePath = path.join(window.External.config.fullExodosPath, fixSlashes(game.musicPath));
        if (!fs.existsSync(absolutePath)) {
            game.musicPath = "";
        }
    }
}

export function createMusicWatcher(platform: string): chokidar.FSWatcher {
    const musicPath = getPlatformMusicPath(platform);
    console.log(`Initializing music watcher for ${platform} path ${musicPath}`);

    const watcher = chokidar.watch(musicPath, {
        depth: 0,
        persistent: true,
        followSymlinks: false,
        ignoreInitial: true,
    });

    watcher
    .on("add", (filePath) => {
        if (!musicExtensions.has(path.extname(filePath).toLowerCase())) { return; }
        console.debug(`Music ${filePath} added.`);
        const relativePath = getRelativePath(filePath, window.External.config.fullExodosPath);
        const title = extractTitleFromMediaPath(filePath, window.External.config.fullExodosPath);
        if (title) {
            const game = getGameByTitle(title);
            if (game) {
                console.debug(`Found the game for new music. Updating game ${title}`);
                store.dispatch(updateGame({ game: { ...game, musicPath: relativePath } }));
            }
        }
    })
    .on("error", (error) => console.log(`Watcher error: ${error}`));

    return watcher;
}

function getPlatformMusicPath(platform: string) {
    return path.join(window.External.config.fullExodosPath, "Music", platform);
}
