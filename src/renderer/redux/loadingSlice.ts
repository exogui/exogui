import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export type PlatformLoadingProgress = {
    currentIndex: number;
    total: number;
    currentName: string;
};

export type LoadingState = {
    platformsLoaded: boolean;
    playlistsLoaded: boolean;
    execLoaded: boolean;
    platformLoadingProgress?: PlatformLoadingProgress;
    errorMessage?: string;
};

const initialState: LoadingState = {
    platformsLoaded: false,
    playlistsLoaded: false,
    execLoaded: false,
    platformLoadingProgress: undefined,
    errorMessage: undefined,
};

const loadingSlice = createSlice({
    name: "loading",
    initialState,
    reducers: {
        initializeLoading: () => {},
        setPlatformsLoaded: (state: LoadingState) => {
            state.platformsLoaded = true;
            state.platformLoadingProgress = undefined;
        },
        setPlaylistsLoaded: (state: LoadingState) => {
            state.playlistsLoaded = true;
        },
        setExecLoaded: (state: LoadingState) => {
            state.execLoaded = true;
        },
        setPlatformLoadingProgress: (
            state: LoadingState,
            { payload }: PayloadAction<PlatformLoadingProgress>
        ) => {
            state.platformLoadingProgress = payload;
        },
        setLoadingError: (
            state: LoadingState,
            { payload }: PayloadAction<string>
        ) => {
            state.errorMessage = payload;
        },
    },
});

export const {
    initializeLoading,
    setPlatformsLoaded,
    setPlaylistsLoaded,
    setExecLoaded,
    setPlatformLoadingProgress,
    setLoadingError,
} = loadingSlice.actions;
export default loadingSlice.reducer;
