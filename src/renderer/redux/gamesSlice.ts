import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import {
    IAdditionalApplicationInfo,
    IGameCollection,
    IGameInfo,
} from "@shared/game/interfaces";

export type GamesState = {
    totalGames: number;
    libraries: string[];
} & IGameCollection;

export type GameUpdatedAction = {
    game: IGameInfo;
};

export type AddAddAppAction = {
    addApp: IAdditionalApplicationInfo;
};

export type AddVideoAction = {
    videoPath: string;
};

const initialState: GamesState = {
    games: [],
    addApps: [],
    totalGames: 0,
    libraries: [],
};

const gamesSlice = createSlice({
    name: "games",
    initialState,
    reducers: {
        setGames: (
            state: GamesState,
            { payload }: PayloadAction<IGameCollection>
        ) => {
            state.games = payload.games;
            state.addApps = payload.addApps;
            state.totalGames = payload.games.length;
        },
        setLibraries: (
            state: GamesState,
            { payload }: PayloadAction<string[]>
        ) => {
            state.libraries = payload;
        },
        updateGame: (
            state: GamesState,
            { payload }: PayloadAction<GameUpdatedAction>
        ) => {
            const gameIdx = state.games.findIndex(
                (g) => g.id === payload.game.id
            );
            if (gameIdx >= 0) state.games[gameIdx] = payload.game;
        },
        addAddAppsForGame: (
            state: GamesState,
            { payload }: PayloadAction<AddAddAppAction>
        ) => {
            state.addApps = [...state.addApps, payload.addApp];
        },
    },
});

export const {
    setLibraries,
    setGames,
    updateGame,
    addAddAppsForGame,
} = gamesSlice.actions;
export default gamesSlice.reducer;
