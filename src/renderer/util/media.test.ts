jest.mock("./games", () => ({ getGameByTitle: jest.fn() }));
jest.mock("@renderer/redux/store", () => ({ getState: jest.fn(), dispatch: jest.fn() }));
jest.mock("@renderer/redux/gamesSlice", () => ({ updateGame: jest.fn() }));
jest.mock("chokidar", () => ({ watch: jest.fn(() => ({ on: jest.fn() })) }));

import { GameMusicCollection, IGameInfo } from "@shared/game/interfaces";
import { mapGamesMusic } from "./media";

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
        const game = makeGame("eXo\\eXoDOS\\!dos\\game\\Some Game (1994).bat");
        game.musicPath = "Music/MS-DOS/Some Game (1994).ogg";
        mapGamesMusic(game, {});
        expect(game.musicPath).toBe("Music/MS-DOS/Some Game (1994).ogg");
    });

    it("overrides XML musicPath when filesystem match exists", () => {
        const game = makeGame("eXo\\eXoDOS\\!dos\\quake\\Quake (1996).bat");
        game.musicPath = "Music\\MS-DOS\\Quake (1996).mp3";
        const music: GameMusicCollection = { "Quake (1996)": "Music/MS-DOS/Quake (1996).ogg" };
        mapGamesMusic(game, music);
        expect(game.musicPath).toBe("Music/MS-DOS/Quake (1996).ogg");
    });

    it("keeps XML musicPath as fallback when filesystem has no match", () => {
        const game = makeGame("eXo\\eXoDOS\\!dos\\storm\\Storm (1987).bat");
        game.musicPath = "Music\\MS-DOS\\S.T.O.R.M. (1996).mp3";
        mapGamesMusic(game, {});
        expect(game.musicPath).toBe("Music\\MS-DOS\\S.T.O.R.M. (1996).mp3");
    });
});
