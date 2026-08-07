jest.mock("./games", () => ({ getGameByTitle: jest.fn() }));
jest.mock("@renderer/redux/store", () => ({ getState: jest.fn(), dispatch: jest.fn() }));
jest.mock("@renderer/redux/gamesSlice", () => ({ updateGame: jest.fn() }));
jest.mock("chokidar", () => ({ watch: jest.fn(() => ({ on: jest.fn() })) }));

import * as fs from "fs";
import { GameImagesCollection, GameMusicCollection, GameVideosCollection, IGameInfo } from "@shared/game/interfaces";
import {
    assignGameImages,
    convertToGameTitleIndex,
    createCategoryImageIndex,
    getGameTitleIndexFromFilename,
    indexImage,
    mapGameVideo,
    mapGamesMusic,
} from "./media";

function makeGame(applicationPath: string): IGameInfo {
    return {
        id: "1",
        title: "Test Game",
        convertedTitle: "Test Game",
        alternateTitles: "",
        platform: "MS-DOS",
        series: "",
        developer: "",
        publisher: "",
        dateAdded: "",
        source: "",
        playMode: "",
        status: "",
        notes: "",
        genre: "",
        applicationPath,
        rootFolder: "",
        launchCommand: "",
        releaseYear: "1993",
        version: "",
        originalDescription: "",
        language: "",
        favorite: false,
        region: "",
        rating: "",
        maxPlayers: 1,
        library: "",
        orderTitle: "Test Game",
        placeholder: false,
        manualPath: "",
        musicPath: "",
        thumbnailPath: "",
        configurationPath: "",
        installed: false,
        media: { images: {}, video: "" },
    };
}

describe("mapGamesMusic", () => {
    beforeAll(() => {
        (window as any).External = { config: { fullExodosPath: "/test" } };
    });

    afterAll(() => {
        delete (window as any).External;
    });

    it("sets musicPath when bat basename matches", () => {
        const game = makeGame("eXo\\eXoDOS\\!dos\\quake\\Quake (1996).bat");
        const music: GameMusicCollection = { "Quake (1996)": "Music/MS-DOS/Quake (1996).mp3" };
        mapGamesMusic(game, music);
        expect(game.musicPath).toBe("Music/MS-DOS/Quake (1996).mp3");
    });

    it("does not set musicPath when no match", () => {
        const game = makeGame("eXo\\eXoDOS\\!dos\\mi1\\Secret of Monkey Island, The (1990).bat");
        const music: GameMusicCollection = { "Quake (1996)": "Music/MS-DOS/Quake (1996).mp3" };
        mapGamesMusic(game, music);
        expect(game.musicPath).toBe("");
    });

    it("does not overwrite existing musicPath when no match", () => {
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
        const game = makeGame("eXo\\eXoDOS\\!dos\\game\\Some Game (1994).bat");
        game.musicPath = "Music/MS-DOS/Some Game (1994).ogg";
        mapGamesMusic(game, {});
        expect(game.musicPath).toBe("Music/MS-DOS/Some Game (1994).ogg");
        jest.restoreAllMocks();
    });

    it("overrides XML musicPath when filesystem match exists", () => {
        const game = makeGame("eXo\\eXoDOS\\!dos\\quake\\Quake (1996).bat");
        game.musicPath = "Music\\MS-DOS\\Quake (1996).mp3";
        const music: GameMusicCollection = { "Quake (1996)": "Music/MS-DOS/Quake (1996).ogg" };
        mapGamesMusic(game, music);
        expect(game.musicPath).toBe("Music/MS-DOS/Quake (1996).ogg");
    });

    it("keeps XML musicPath as fallback when filesystem has no match", () => {
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
        const game = makeGame("eXo\\eXoDOS\\!dos\\storm\\Storm (1987).bat");
        game.musicPath = "Music\\MS-DOS\\S.T.O.R.M. (1996).mp3";
        mapGamesMusic(game, {});
        expect(game.musicPath).toBe("Music\\MS-DOS\\S.T.O.R.M. (1996).mp3");
        jest.restoreAllMocks();
    });
});

describe("mapGameVideo", () => {
    beforeAll(() => {
        (window as any).External = { config: { fullExodosPath: "/test" } };
    });

    afterAll(() => {
        delete (window as any).External;
    });

    // Mirrors how loadPlatformVideos keys the collection: filename without ".mp4" -> encoded filename
    function videosFor(...filenames: string[]): GameVideosCollection {
        const videos: GameVideosCollection = {};
        for (const f of filenames) {
            videos[f.split(".mp4")[0]] = encodeURIComponent(f);
        }
        return videos;
    }

    it("sets video when bat basename matches", () => {
        const game = makeGame("eXo\\eXoDOS\\!dos\\quake\\Quake (1996).bat");
        game.platform = "MS-DOS";
        const videos = videosFor("Quake (1996).mp4");
        mapGameVideo(game, videos);
        expect(game.media.video).toBe(
            `Videos/MS-DOS/${encodeURIComponent("Quake (1996).mp4")}`
        );
    });

    it("sets video when filename contains a period mid-name (e.g. 'Vs.')", () => {
        const game = makeGame(
            "eXo\\eXoDREAMM\\!DREAMM\\Star Wars - X-Wing Vs. TIE Fighter Gold (2000)\\Star Wars - X-Wing Vs. TIE Fighter Gold (2000).bat"
        );
        game.platform = "DREAMM";
        const videos = videosFor("Star Wars - X-Wing Vs. TIE Fighter Gold (2000).mp4");
        mapGameVideo(game, videos);
        expect(game.media.video).toBe(
            `Videos/DREAMM/${encodeURIComponent("Star Wars - X-Wing Vs. TIE Fighter Gold (2000).mp4")}`
        );
    });
});

describe("getGameTitleIndexFromFilename", () => {
    it.each([
        ["3-D Ultra Pinball-01.png",       "3-D Ultra Pinball"],
        ["3D Ultra Pinball (1995).png",    "3D Ultra Pinball (1995)"],
        ["3D Ultra Pinball (1995)-01.png", "3D Ultra Pinball (1995)"],
        ["Apache-02.png",                  "Apache"],
        ["Apache (1995).png",              "Apache (1995)"],
        ["Alien Tales (1996)-02.png",      "Alien Tales (1996)"],
        ["Foo-10.png",                     "Foo"],
        ["Foo-100.png",                    "Foo"],
    ])("extracts title from %s", (filename, expected) => {
        expect(getGameTitleIndexFromFilename(filename)).toBe(expected);
    });

    it("returns null for bare extension", () => {
        expect(getGameTitleIndexFromFilename(".png")).toBeNull();
    });
});

describe("convertToGameTitleIndex", () => {
    it.each([
        ["3-D Ultra Pinball",                             "3D ULTRA PINBALL"],
        ["3D Ultra Pinball",                              "3D ULTRA PINBALL"],
        ["3D Ultra Pinball (1995)",                       "3D ULTRA PINBALL"],
        ["3-D Ultra Pinball: Creep Night",                "3D ULTRA PINBALL CREEP NIGHT"],
        ["3-D Ultra Pinball - Creep Night",               "3D ULTRA PINBALL CREEP NIGHT"],
        ["3-D Ultra Pinball_ Creep Night",                "3D ULTRA PINBALL CREEP NIGHT"],
        ["Al Unser, Jr. Arcade Racing",                   "AL UNSER JR ARCADE RACING"],
        ["Al Unser Jr. Arcade Racing",                    "AL UNSER JR ARCADE RACING"],
        ["American Civil War: From Sumter to Appomattox", "AMERICAN CIVIL WAR FROM SUMTER TO APPOMATTOX"],
        ["American Civil War - From Sumter to Appomattox","AMERICAN CIVIL WAR FROM SUMTER TO APPOMATTOX"],
        ["Apache (1995)",                                 "APACHE"],
    ])("normalizes %s", (input, expected) => {
        expect(convertToGameTitleIndex(input)).toBe(expected);
    });
});

describe("image filename to XML title round-trip", () => {
    const matches = (filename: string, gameTitle: string): boolean => {
        const raw = getGameTitleIndexFromFilename(filename);
        if (raw === null) return false;
        return convertToGameTitleIndex(raw) === convertToGameTitleIndex(gameTitle);
    };

    it.each([
        // 3-D Ultra Pinball (base)
        ["3-D Ultra Pinball-01.png",                                        "3-D Ultra Pinball"],
        ["3D Ultra Pinball (1995).png",                                     "3-D Ultra Pinball"],
        ["3D Ultra Pinball (1995)-01.png",                                  "3-D Ultra Pinball"],
        ["3D Ultra Pinball (1995)-02.png",                                  "3-D Ultra Pinball"],
        // 3-D Ultra Pinball: Creep Night
        ["3-D Ultra Pinball - Creep Night (1996).png",                      "3-D Ultra Pinball: Creep Night"],
        ["3-D Ultra Pinball_ Creep Night-01.png",                           "3-D Ultra Pinball: Creep Night"],
        // Ace Ventura
        ["Ace Ventura (1996).png",                                          "Ace Ventura"],
        ["Ace Ventura-01.png",                                              "Ace Ventura"],
        // Al Unser
        ["Al Unser Jr. Arcade Racing (1995).png",                           "Al Unser, Jr. Arcade Racing"],
        ["Al Unser, Jr. Arcade Racing-01.png",                              "Al Unser, Jr. Arcade Racing"],
        // Alien Tales
        ["Alien Tales (1996).png",                                          "Alien Tales"],
        ["Alien Tales (1996)-02.png",                                       "Alien Tales"],
        // Allied General
        ["Allied General (1995).png",                                       "Allied General"],
        ["Allied General-01.png",                                           "Allied General"],
        // American Civil War
        ["American Civil War - From Sumter to Appomattox (1996).png",       "American Civil War: From Sumter to Appomattox"],
        ["American Civil War_ From Sumter to Appomattox-01.png",            "American Civil War: From Sumter to Appomattox"],
        // Apache
        ["Apache (1995).png",                                               "Apache"],
        ["Apache-02.png",                                                   "Apache"],
    ])("matches file '%s' to game '%s'", (filename, gameTitle) => {
        expect(matches(filename, gameTitle)).toBe(true);
    });

    it.each([
        // Base game must NOT pick up Creep Night images
        ["3-D Ultra Pinball - Creep Night (1996).png", "3-D Ultra Pinball"],
        ["3-D Ultra Pinball_ Creep Night-01.png",      "3-D Ultra Pinball"],
        // Creep Night must NOT pick up base game image
        ["3-D Ultra Pinball-01.png",                   "3-D Ultra Pinball: Creep Night"],
    ])("does NOT match file '%s' to game '%s'", (filename, gameTitle) => {
        expect(matches(filename, gameTitle)).toBe(false);
    });
});

describe("assignGameImages", () => {
    // Filenames below are taken verbatim from the eXoDOS collection.
    const GAMEPLAY = "Screenshot - Gameplay";
    const TITLE_SHOT = "Screenshot - Game Title";

    function collectionOf(files: Record<string, string[]>): GameImagesCollection {
        const collection: GameImagesCollection = {};
        for (const [category, filenames] of Object.entries(files)) {
            const index = createCategoryImageIndex();
            for (const filename of filenames) {
                indexImage(index, filename, filename);
            }
            collection[category] = index;
        }
        return collection;
    }

    function gameOf(title: string, id: string): IGameInfo {
        const game = makeGame("eXo\\eXoDemoScn\\!demoscn\\x\\x (1993).bat");
        game.title = title;
        game.id = id;
        game.platform = "eXoDemoScene";
        game.media = { images: {}, video: "" };
        return game;
    }

    function assign(
        games: [title: string, id: string][],
        files: Record<string, string[]>
    ): Record<string, IGameInfo> {
        const gameInfos = games.map(([title, id]) => gameOf(title, id));
        assignGameImages(gameInfos, collectionOf(files));
        return Object.fromEntries(gameInfos.map((g) => [g.id, g]));
    }

    it("gives GUID-suffixed files to the matching game and bare files to its sibling", () => {
        const games = assign(
            [
                ["Creation", "0f2d7945-e89f-4ece-aa98-ae5836b4d145"],
                ["Creation", "408653ba-be70-478c-9e7d-7bf27dd4e907"],
            ],
            {
                [GAMEPLAY]: [
                    "Creation-01.png",
                    "Creation.408653ba-be70-478c-9e7d-7bf27dd4e907-01.png",
                    "Creation.408653ba-be70-478c-9e7d-7bf27dd4e907-02.png",
                ],
            }
        );

        expect(games["0f2d7945-e89f-4ece-aa98-ae5836b4d145"].media.images[GAMEPLAY])
        .toEqual(["Creation-01.png"]);
        expect(games["408653ba-be70-478c-9e7d-7bf27dd4e907"].media.images[GAMEPLAY])
        .toEqual([
            "Creation.408653ba-be70-478c-9e7d-7bf27dd4e907-01.png",
            "Creation.408653ba-be70-478c-9e7d-7bf27dd4e907-02.png",
        ]);
    });

    it("does not fall back to bare-title files in categories where the GUID-named game has none", () => {
        const games = assign(
            [
                ["Evil", "3621627c-4517-4369-bf93-5366cab20dcf"],
                ["Evil", "6c12e926-eb57-4439-8085-9d6239335d56"],
            ],
            {
                [GAMEPLAY]: [
                    "Evil.6c12e926-eb57-4439-8085-9d6239335d56-01.png",
                ],
                [TITLE_SHOT]: ["Evil-01.png"],
            }
        );

        const guidNamed = games["6c12e926-eb57-4439-8085-9d6239335d56"];
        expect(guidNamed.media.images[GAMEPLAY]).toEqual([
            "Evil.6c12e926-eb57-4439-8085-9d6239335d56-01.png",
        ]);
        expect(guidNamed.media.images[TITLE_SHOT]).toBeUndefined();
        expect(games["3621627c-4517-4369-bf93-5366cab20dcf"].media.images[TITLE_SHOT])
        .toEqual(["Evil-01.png"]);
    });

    it.each([
        ["Alive", "Alive-01.png", "Alive!", "Alive!-01.png"],
        ["Rip-Off", "Rip-Off-01.png", "RipOff", "RipOff-01.png"],
        ["Why", "Why-01.png", "Why?", "Why_-01.png"],
        ["Snow-Tro", "Snow-Tro-01.png", "Snowtro", "Snowtro-01.png"],
        ["-", "--01.png", "?", "_-01.png"],
    ])(
        "keeps '%s' and '%s' apart despite punctuation",
        (titleA, fileA, titleB, fileB) => {
            const games = assign(
                [
                    [titleA, "id-a"],
                    [titleB, "id-b"],
                ],
                { [GAMEPLAY]: [fileA, fileB] }
            );

            expect(games["id-a"].media.images[GAMEPLAY]).toEqual([fileA]);
            expect(games["id-b"].media.images[GAMEPLAY]).toEqual([fileB]);
        }
    );

    it("keeps titles that differ only in casing apart", () => {
        const games = assign(
            [
                ["Warp", "f3c72f25-ce0b-4a9f-8831-b45902307709"],
                ["WARP", "2eb4d438-81e0-431b-a080-46dcd2a1e746"],
            ],
            { [GAMEPLAY]: ["Warp-01.png", "WARP-02.png"] }
        );

        expect(games["f3c72f25-ce0b-4a9f-8831-b45902307709"].media.images[GAMEPLAY])
        .toEqual(["Warp-01.png"]);
        expect(games["2eb4d438-81e0-431b-a080-46dcd2a1e746"].media.images[GAMEPLAY])
        .toEqual(["WARP-02.png"]);
    });

    it("treats a trailing release year as a disambiguator", () => {
        const games = assign(
            [
                ["SSI Spring Catalog (1984)", "id-84"],
                ["SSI Spring Catalog (1985)", "id-85"],
            ],
            {
                [GAMEPLAY]: [
                    "SSI Spring Catalog (1984)-01.jpg",
                    "SSI Spring Catalog (1985)-01.jpg",
                ],
            }
        );

        expect(games["id-84"].media.images[GAMEPLAY]).toEqual([
            "SSI Spring Catalog (1984)-01.jpg",
        ]);
        expect(games["id-85"].media.images[GAMEPLAY]).toEqual([
            "SSI Spring Catalog (1985)-01.jpg",
        ]);
    });

    it("still matches loosely when no game claims the file by its exact name", () => {
        const games = assign([["3-D Ultra Pinball", "id-a"]], {
            [GAMEPLAY]: ["3D Ultra Pinball (1995).png"],
        });

        expect(games["id-a"].media.images[GAMEPLAY]).toEqual([
            "3D Ultra Pinball (1995).png",
        ]);
    });

    it("does not hand an ambiguous loose match to either candidate", () => {
        const games = assign(
            [
                ["First", "id-a"],
                ["First!", "id-b"],
            ],
            { [GAMEPLAY]: ["First!-01.png"] }
        );

        expect(games["id-a"].media.images[GAMEPLAY]).toBeUndefined();
        expect(games["id-b"].media.images[GAMEPLAY]).toEqual(["First!-01.png"]);
    });

    it("picks the thumbnail from the game's own images by preference order", () => {
        const games = assign(
            [
                ["Timeout", "1b9eb999-47ee-4835-b777-319f72fa38a2"],
                ["TimeOut", "97da71eb-c94f-498a-b344-937790ea1350"],
            ],
            {
                "Box - Front": [
                    "Timeout-01.png",
                    "TimeOut.97da71eb-c94f-498a-b344-937790ea1350-02.png",
                ],
            }
        );

        expect(games["1b9eb999-47ee-4835-b777-319f72fa38a2"].thumbnailPath)
        .toBe("Images/eXoDemoScene/Timeout-01.png");
        expect(games["97da71eb-c94f-498a-b344-937790ea1350"].thumbnailPath)
        .toBe(
            "Images/eXoDemoScene/TimeOut.97da71eb-c94f-498a-b344-937790ea1350-02.png"
        );
    });
});
