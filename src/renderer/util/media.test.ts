jest.mock("./games", () => ({ getGameByTitle: jest.fn() }));
jest.mock("@renderer/redux/store", () => ({ getState: jest.fn(), dispatch: jest.fn() }));
jest.mock("@renderer/redux/gamesSlice", () => ({ updateGame: jest.fn() }));
jest.mock("chokidar", () => ({ watch: jest.fn(() => ({ on: jest.fn() })) }));

import * as fs from "fs";
import { GameMusicCollection, IGameInfo } from "@shared/game/interfaces";
import { convertToGameTitleIndex, getGameTitleIndexFromFilename, mapGamesMusic } from "./media";

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
        recommended: false,
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
