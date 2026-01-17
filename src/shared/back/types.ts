import { IAppCommandsMappingData } from "@shared/mappings/interfaces";
import { SocketTemplate } from "@shared/socket/types";
import { MessageBoxOptions, OpenExternalOptions } from "electron";
import { IAppConfigData } from "../config/interfaces";
import { IAdditionalApplicationInfo, IGameInfo } from "../game/interfaces";
import { ExecMapping, GamePlaylist } from "../interfaces";
import { ILogEntry, ILogPreEntry } from "../Log/interface";
import { IAppPreferencesData } from "../preferences/interfaces";
import { Theme } from "../ThemeFile";

export enum BackIn {
    GENERIC_RESPONSE,
    KEEP_ALIVE,
    INIT_LISTEN,
    GET_GAMES_TOTAL,
    SET_LOCALE,
    GET_EXEC,
    SAVE_GAME,
    GET_GAME,
    GET_ALL_GAMES,
    RANDOM_GAMES,
    LAUNCH_GAME,
    LAUNCH_GAME_SETUP,
    LAUNCH_ADDAPP,
    QUICK_SEARCH,
    ADD_LOG,
    GET_PLAYLISTS,
    LAUNCH_COMMAND,
    QUIT,
    /** Get a page of a browse view. */
    BROWSE_VIEW_PAGE,
    BROWSE_VIEW_INDEX,
    /** Get all data needed on init (by the renderer). */
    GET_RENDERER_INIT_DATA,
    /** Get all data needed on init (by the renderer). */
    GET_MAIN_INIT_DATA,
    /** Update any number of configs. */
    UPDATE_CONFIG,
    /** Update any number of preferences. */
    UPDATE_PREFERENCES,
    PLAY_AUDIO_FILE,
    TOGGLE_MUSIC,
    SET_VOLUME,
}

type UnknownCallback = (...args: any[]) => any;

export type BackInTemplate = SocketTemplate<BackIn, {
    [BackIn.GENERIC_RESPONSE]: UnknownCallback;
    [BackIn.KEEP_ALIVE]: () => void;
    [BackIn.INIT_LISTEN]: () => BackInit[];
    [BackIn.GET_GAMES_TOTAL]: UnknownCallback;
    [BackIn.SET_LOCALE]: (localeCode: string) => void;
    [BackIn.GET_EXEC]: () => ExecMapping[];
    [BackIn.SAVE_GAME]: UnknownCallback;
    [BackIn.GET_GAME]: UnknownCallback;
    [BackIn.GET_ALL_GAMES]: UnknownCallback;
    [BackIn.RANDOM_GAMES]: UnknownCallback;
    [BackIn.LAUNCH_GAME]: (game: IGameInfo, addApps: IAdditionalApplicationInfo[]) => void;
    [BackIn.LAUNCH_GAME_SETUP]: (game: IGameInfo, addApps: IAdditionalApplicationInfo[]) => void;
    [BackIn.LAUNCH_ADDAPP]: (game: IGameInfo, addApp: IAdditionalApplicationInfo) => void;
    [BackIn.QUICK_SEARCH]: UnknownCallback;
    [BackIn.ADD_LOG]: (log: ILogPreEntry) => void;
    [BackIn.GET_PLAYLISTS]: () => GamePlaylist[];
    [BackIn.LAUNCH_COMMAND]: (filePath: string) => void;
    [BackIn.QUIT]: () => void;
    [BackIn.BROWSE_VIEW_PAGE]: UnknownCallback;
    [BackIn.BROWSE_VIEW_INDEX]: UnknownCallback;
    [BackIn.GET_RENDERER_INIT_DATA]: () => GetRendererInitDataResponse;
    [BackIn.GET_MAIN_INIT_DATA]: () => GetMainInitDataResponse;
    [BackIn.UPDATE_CONFIG]: (data: UpdateConfigData) => void;
    [BackIn.UPDATE_PREFERENCES]: (data: IAppPreferencesData) => void;
    [BackIn.PLAY_AUDIO_FILE]: (filePath: string) => void;
    [BackIn.TOGGLE_MUSIC]: (newState: boolean) => void;
    [BackIn.SET_VOLUME]: (volume: number) => void;
}>;

export enum BackOut {
    GENERIC_RESPONSE,
    INIT_EVENT,
    OPEN_DIALOG,
    OPEN_EXTERNAL,
    LOCALE_UPDATE,
    BROWSE_VIEW_PAGE_RESPONSE,
    GET_MAIN_INIT_DATA,
    UPDATE_PREFERENCES_RESPONSE,
    BROWSE_CHANGE,
    IMAGE_CHANGE,
    LOG_ENTRY_ADDED,
    THEME_CHANGE,
    THEME_LIST_CHANGE,
    PLAYLIST_UPDATE,
    PLAYLIST_REMOVE,
    GAME_CHANGE,
    QUIT,
}

export type BackOutTemplate = SocketTemplate<BackOut, {
    [BackOut.GENERIC_RESPONSE]: UnknownCallback;
    [BackOut.INIT_EVENT]: (done: BackInit[]) => void;
    [BackOut.OPEN_DIALOG]: (options: MessageBoxOptions) => Promise<number>;
    [BackOut.OPEN_EXTERNAL]: (url: string, options?: OpenExternalOptions) => void;
    [BackOut.LOCALE_UPDATE]: (localeCode: string) => void;
    [BackOut.BROWSE_VIEW_PAGE_RESPONSE]: UnknownCallback;
    [BackOut.GET_MAIN_INIT_DATA]: UnknownCallback;
    [BackOut.UPDATE_PREFERENCES_RESPONSE]: (data: IAppPreferencesData) => void;
    [BackOut.BROWSE_CHANGE]: UnknownCallback;
    [BackOut.IMAGE_CHANGE]: UnknownCallback;
    [BackOut.LOG_ENTRY_ADDED]: (entry: ILogEntry, index: number) => void;
    [BackOut.THEME_CHANGE]: (theme: string) => void;
    [BackOut.THEME_LIST_CHANGE]: (themeList: Theme[]) => void;
    [BackOut.PLAYLIST_UPDATE]: UnknownCallback;
    [BackOut.PLAYLIST_REMOVE]: (filename: string) => void;
    [BackOut.GAME_CHANGE]: (game: IGameInfo) => void;
    [BackOut.QUIT]: UnknownCallback;
}>;

export const BackRes = {
    ...BackOut,
    ...BackIn
};

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BackRes = BackOut | BackIn;
export type BackResTemplate = BackOutTemplate & BackInTemplate;
export type BackResParams<T extends BackRes> = Parameters<BackResTemplate[T]>;
export type BackResReturnTypes<T extends BackRes> = ReturnType<BackResTemplate[T]>;

export type WrappedRequest<T = any> = {
    /** Identifier of the response */
    id: string;
    /** Type of the request */
    type: BackIn;
    /** Data contained in the response (if any) */
    data?: T;
};

export type WrappedResponse<T = any> = {
    /** Identifier of the response */
    id: string;
    /** Type of the response */
    type: BackOut;
    /** Data contained in the response (if any) */
    data?: T;
};

export type BackInitArgs = {
    /** Path to the folder containing the preferences and config files. */
    configFolder: string;
    /** Secret string used for authentication. */
    secret: string;
    isDev: boolean;
    exePath: string;
    basePath: string;
    /** If the back should accept remote clients to connect (renderers from different machines). */
    acceptRemote: boolean;
};

export enum BackInit {
    PLAYLISTS,
    EXEC,
}

export type AddLogData = ILogPreEntry;

export type InitEventData = {
    done: BackInit[];
};

export type GetMainInitDataResponse = {
    config: IAppConfigData;
    preferences: IAppPreferencesData;
};

export type GetRendererInitDataResponse = {
    config: IAppConfigData;
    preferences: IAppPreferencesData;
    commandMappings: IAppCommandsMappingData;
    fileServerPort: number;
    log: ILogEntry[];
    themes: Theme[];
    playlists?: GamePlaylist[];
    localeCode: string;
    vlcAvailable: boolean;
};

export type GetGamesTotalResponseData = number;

export type SetLocaleData = string;

export type LocaleUpdateData = string;

export type GetExecData = ExecMapping[];

export type OpenDialogData = MessageBoxOptions;

export type ShowMessageBoxFunc = (options: MessageBoxOptions) => Promise<number>;

export type OpenDialogResponseData = number;

export type OpenExternalData = {
    url: string;
    options?: OpenExternalOptions;
};

export type OpenExternalResponseData = {
    error?: Error;
};

export type LaunchGameData = {
    game: IGameInfo;
    addApps: IAdditionalApplicationInfo[];
};

export type GetGameData = {
    id: string;
};

export type GetGameResponseData = {
    game?: IGameInfo;
    addApps?: IAdditionalApplicationInfo[];
};

export type GetAllGamesResponseData = {
    games: IGameInfo[];
};

export type RandomGamesData = {
    count: number;
};

export type RandomGamesResponseData = IGameInfo[];

export type LaunchAddAppData = {
    game: IGameInfo;
    addApp: IAdditionalApplicationInfo;
};

export type LaunchExodosContentData = {
    path: string;
};

export type BrowseViewAllData = {
    libraries: string[];
};

export type BrowseViewUpdateData = {
    viewId?: string;
    query: unknown;
};

export type BrowseViewResponseData = {
    viewId: string;
    total: number;
};

export type BrowseViewPageData = {
    offset: number;
    limit: number;
    query: GameQuery;
};

export type BrowseViewPageResponseData = {
    games: IGameInfo[];
    offset: number;
    total?: number;
};

export type BrowseViewIndexData = {
    gameId: string;
    query: GameQuery;
};

export type BrowseViewIndexResponseData = {
    index: number;
};

export type QuickSearchData = {
    query: GameQuery;
    search: string;
};

export type QuickSearchResponseData = {
    id?: string;
    index?: number;
};

type GameQuery = {
    library: string;
    search: string;
    playlistId?: string;
    orderBy: string;
    orderReverse: string;
};

export type UpdateConfigData = Partial<IAppConfigData>;

export type BrowseChangeData = {
    library?: string;
    gamesTotal: number;
};

export type ImageChangeData = {
    folder: string;
    id: string;
};

export type LogEntryAddedData = {
    entry: ILogEntry;
    index: number;
};

export type ThemeChangeData = string;

export type ThemeListChangeData = Theme[];

export type PlaylistUpdateData = GamePlaylist;

export type PlaylistRemoveData = string;

export type GetPlaylistResponse = GamePlaylist[];
