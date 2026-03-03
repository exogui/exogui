import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import {
    isGameFilterEmpty,
    mergeGameFilters,
    parseAdvancedFilter,
    parseUserInput,
} from "@renderer/util/search";
import { deepCopy, fixSlashes } from "@shared/Util";
import { BackIn } from "@shared/back/types";
import { getOrderFunction } from "@shared/game/GameFilter";
import { IGameInfo } from "@shared/game/interfaces";
import { GameFilter, GamePlaylist } from "@shared/interfaces";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import { getDefaultBooleanFilter, getDefaultCompareFilter, getDefaultFieldFilter } from "@shared/utils/search";
import * as path from "path";

export type ResultsView = {
    selectedGame?: IGameInfo;
    selectedPlaylist?: GamePlaylist;
    games: IGameInfo[];
    orderBy: GameOrderBy;
    orderReverse: GameOrderReverse;
    text: string;
    advancedFilter: AdvancedFilter;
    filter: GameFilter;
    loaded: boolean;
};

export type AdvancedFilter = {
    installed?: boolean;
    recommended?: boolean;
    series: string[];
    developer: string[];
    publisher: string[];
    genre: string[];
    playMode: string[];
    region: string[];
    releaseYear: string[];
    rating: string[];
};

type SearchState = {
    views: Record<string, ResultsView>;
    isMusicPlaying: boolean;
};

export type SearchSetTextAction = {
    view: string;
    text: string;
};

export type SearchSetViewGamesAction = {
    view: string;
    games: IGameInfo[];
};

export type SearchSetGameAction = {
    view: string;
    game?: IGameInfo;
};

export type SearchSetPlaylistAction = {
    view: string;
    playlist?: GamePlaylist;
};

export type SearchOrderByAction = {
    view: string;
    value: GameOrderBy;
};

export type SearchOrderReverseAction = {
    view: string;
    value: GameOrderReverse;
};

export type SearchAdvancedFilterAction = {
    view: string;
    filter: AdvancedFilter;
};

export type SearchFilterRecommendedAction = {
    view: string;
    value?: boolean;
};

export type SearchViewAction = {
    view: string;
};

const initialState: SearchState = {
    views: {},
    isMusicPlaying: false,
};

const searchSlice = createSlice({
    name: "search",
    initialState,
    reducers: {
        initializeViews(
            state: SearchState,
            { payload }: PayloadAction<string[]>
        ) {
            console.debug(`Creating views for: ${payload}`);
            const prefs = window.External.preferences.data;
            for (const view of payload) {
                if (!state.views[view]) {
                    const installedPref = prefs.browsePageSearchInstalled;
                    const recommendedPref = prefs.browsePageSearchRecommended;
                    const newView: ResultsView = {
                        games: [],
                        text: "",
                        orderBy: prefs.browsePageSearchOrderBy ?? "title",
                        orderReverse: prefs.browsePageSearchOrderReverse ?? "ascending",
                        advancedFilter: {
                            installed: installedPref === null ? undefined : installedPref,
                            recommended: recommendedPref === null ? undefined : recommendedPref,
                            series: [],
                            developer: [],
                            publisher: [],
                            genre: [],
                            playMode: [],
                            region: [],
                            releaseYear: [],
                            rating: [],
                        },
                        loaded: false,
                        filter: {
                            subfilters: [],
                            whitelist: getDefaultFieldFilter(),
                            blacklist: getDefaultFieldFilter(),
                            exactWhitelist: getDefaultFieldFilter(),
                            exactBlacklist: getDefaultFieldFilter(),
                            equalTo: getDefaultCompareFilter(),
                            greaterThan: getDefaultCompareFilter(),
                            lessThan: getDefaultCompareFilter(),
                            booleans: getDefaultBooleanFilter(),
                            matchAny: false,
                        },
                    };
                    newView.filter = createFilter(newView);
                    state.views[view] = newView;
                }
            }
        },
        setSearchText(
            state: SearchState,
            { payload }: PayloadAction<SearchSetTextAction>
        ) {
            const view = state.views[payload.view];
            if (view) {
                view.text = payload.text;
                view.filter = createFilter(view);
            }
        },
        setViewGames(
            state: SearchState,
            { payload }: PayloadAction<SearchSetViewGamesAction>
        ) {
            if (state.views[payload.view]) {
                state.views[payload.view].games = payload.games;
            }
        },
        selectPlaylist(
            state: SearchState,
            { payload }: PayloadAction<SearchSetPlaylistAction>
        ) {
            const view = state.views[payload.view];
            if (view) {
                const playlist = payload.playlist
                    ? deepCopy(payload.playlist)
                    : undefined;
                view.selectedPlaylist = playlist;
                view.filter = createFilter(view);
            }
        },
        selectGame(
            state: SearchState,
            { payload }: PayloadAction<SearchSetGameAction>
        ) {
            const view = state.views[payload.view];
            if (view) {
                view.selectedGame = payload.game
                    ? deepCopy(payload.game)
                    : undefined;
                const musicPath = view.selectedGame?.musicPath;
                const autoplay = window.External.preferences.data.gameMusicPlay;
                if (musicPath && autoplay) {
                    // Play directly without stopping first — VLC keeps its audio pipeline
                    // alive via add+next, avoiding the audio device reinit stutter
                    const fullPath = path.join(window.External.config.fullExodosPath, fixSlashes(musicPath));
                    window.External.back.send(BackIn.PLAY_AUDIO_FILE, fullPath);
                    state.isMusicPlaying = true;
                } else {
                    window.External.back.send(BackIn.STOP_MUSIC);
                    state.isMusicPlaying = false;
                }
            }
        },
        stopMusic(state: SearchState) {
            window.External.back.send(BackIn.STOP_MUSIC);
            state.isMusicPlaying = false;
        },
        playMusic(state: SearchState, { payload }: PayloadAction<string>) {
            window.External.back.send(BackIn.PLAY_AUDIO_FILE, payload);
            state.isMusicPlaying = true;
        },
        forceSearch(
            state: SearchState,
            { payload }: PayloadAction<SearchViewAction>
        ) {
            const view = state.views[payload.view];
            if (view) {
                view.filter = createFilter(view);
            }
        },
        setOrderBy(
            state: SearchState,
            { payload }: PayloadAction<SearchOrderByAction>
        ) {
            const view = state.views[payload.view];
            if (view) {
                view.orderBy = payload.value;
                const orderFn = getOrderFunction(
                    view.orderBy,
                    view.orderReverse
                );
                view.games = view.games.sort(orderFn);
            }
        },
        setOrderReverse(
            state: SearchState,
            { payload }: PayloadAction<SearchOrderReverseAction>
        ) {
            const view = state.views[payload.view];
            if (view) {
                view.orderReverse = payload.value;
                const orderFn = getOrderFunction(
                    view.orderBy,
                    view.orderReverse
                );
                view.games = view.games.sort(orderFn);
            }
        },
        setAdvancedFilter(
            state: SearchState,
            { payload }: PayloadAction<SearchAdvancedFilterAction>
        ) {
            const view = state.views[payload.view];
            if (view) {
                view.advancedFilter = payload.filter;
                view.filter = createFilter(view);
            }
        },
    },
});

function createFilter(view: ResultsView): GameFilter {
    // Build filter for this new search
    let newFilter = parseUserInput(view.text);
    // Merge all filters
    if (view.selectedPlaylist && view.selectedPlaylist.filter) {
        if (isGameFilterEmpty(newFilter)) {
            newFilter = view.selectedPlaylist.filter;
        } else {
            newFilter = mergeGameFilters(
                view.selectedPlaylist.filter,
                newFilter
            );
        }
    }
    const advFilter = parseAdvancedFilter(view.advancedFilter);
    if (!isGameFilterEmpty(advFilter)) {
        if (isGameFilterEmpty(newFilter)) {
            newFilter = advFilter;
        } else {
            newFilter = mergeGameFilters(advFilter, newFilter);
        }
    }

    return newFilter;
}

export const {
    setSearchText,
    setViewGames,
    initializeViews,
    selectPlaylist,
    selectGame,
    forceSearch,
    setOrderBy,
    setOrderReverse,
    setAdvancedFilter,
    stopMusic,
    playMusic,
} = searchSlice.actions;
export default searchSlice.reducer;
