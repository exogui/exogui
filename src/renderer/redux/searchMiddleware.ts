import { PayloadAction, isAnyOf } from "@reduxjs/toolkit";
import { filterGames } from "@renderer/util/gameFilter";
import { getOrderFunction } from "@shared/game/GameFilter";
import { debounce } from "@shared/utils/debounce";
import { startAppListening } from "./listenerMiddleware";
import {
    ResultsView,
    SearchViewAction,
    forceSearch,
    selectGame,
    selectPlaylist,
    setAdvancedFilter,
    setSearchText,
    setViewGames,
} from "./searchSlice";
import store, { RootState } from "./store";
import { GameUpdatedAction, updateGame } from "./gamesSlice";

export function addSearchMiddleware() {
    startAppListening({
        matcher: isAnyOf(
            setSearchText,
            selectPlaylist,
            setAdvancedFilter,
            forceSearch
        ),
        effect: async (
            action: PayloadAction<SearchViewAction>,
            listenerApi
        ) => {
            const state = listenerApi.getState();
            const view = state.searchState.views[action.payload.view];

            if (view) {
                // Perform search
                debounceSearch(state, action.payload.view, view);
            }
        },
    });

    // Refresh view when game is updated. Easiest way to have
    // everything in shape.
    startAppListening({
        matcher: isAnyOf(updateGame),
        effect: async (
            action: PayloadAction<GameUpdatedAction>,
            listenerApi
        ) => {
            const state = listenerApi.getState();
            const viewName = action.payload.game.library;
            const view = state.searchState.views[viewName];
            const game = action.payload.game;

            if (view) {
                if (view.selectedGame?.id === game.id)
                    store.dispatch(
                        selectGame({
                            view: viewName,
                            game,
                            userInitiated: false,
                        })
                    );
                debounceSearch(state, viewName, view);
            }
        },
    });
}

const debounceSearch = debounce(
    (state: RootState, viewName: string, view: ResultsView) => {
        let games = state.gamesState.games;

        if (view.selectedPlaylist) {
            if (view.selectedPlaylist.games.length > 0) {
                const playlistIds = new Set(
                    view.selectedPlaylist.games.map((g) => g.id)
                );
                games = games.filter((g) => playlistIds.has(g.id));
            }
        } else {
            games = games.filter((g) => g.platform === viewName);
        }

        games = filterGames(games, view.filter);

        const orderFn = getOrderFunction(view.orderBy, view.orderReverse);
        games = games.sort(orderFn);

        store.dispatch(
            setViewGames({
                view: viewName,
                games,
            })
        );
    },
    125
);

