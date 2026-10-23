import { PayloadAction, isAnyOf } from "@reduxjs/toolkit";
import { filterGames } from "@renderer/util/gameFilter";
import { selectViewGames } from "@renderer/util/search";
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
            const game = action.payload.game;

            for (const [viewName, view] of Object.entries(state.searchState.views)) {
                if (view.selectedGame?.id === game.id)
                    store.dispatch(
                        selectGame({
                            view: viewName,
                            game,
                            userInitiated: false,
                        })
                    );
                if (viewName === game.library || view.overridesPlatform) {
                    debounceSearch(state, viewName, view);
                }
            }
        },
    });
}

type SearchFunction = (state: RootState, viewName: string, view: ResultsView) => void;

const viewSearches = new Map<string, SearchFunction>();

function debounceSearch(state: RootState, viewName: string, view: ResultsView) {
    let search = viewSearches.get(viewName);
    if (!search) {
        search = debounce(runSearch, 125);
        viewSearches.set(viewName, search);
    }
    search(state, viewName, view);
}

const runSearch: SearchFunction = (state, viewName, view) => {
    let games = selectViewGames(state.gamesState.games, viewName, view);
    games = filterGames(games, view.filter);

    const orderFn = getOrderFunction(view.orderBy, view.orderReverse);
    games = games.sort(orderFn);

    store.dispatch(
        setViewGames({
            view: viewName,
            games,
        })
    );
};

