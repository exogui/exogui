import { BrowsePageLayout } from "../BrowsePageLayout";
import { GameOrderBy, GameOrderReverse } from "../order/interfaces";

/**
 * Contains state of all non-config settings the user can change in the application.
 * This is the data contained in the Preferences file.
 */
export type IAppPreferencesData = {
    /** Scale of the games at the BrowsePage. */
    browsePageGameScale: number;
    /** Layout of game collection at BrowsePage. */
    browsePageLayout: BrowsePageLayout;
    /** If the left sidebar at the BrowsePage should be visible. */
    browsePageShowLeftSidebar: boolean;
    /** If the right sidebar at the BrowsePage should be visible. */
    browsePageShowRightSidebar: boolean;
    /** Width of the left sidebar. (Browse Page) */
    browsePageLeftSidebarWidth: number;
    /** Width of the right sidebar. (Browse Page) */
    browsePageRightSidebarWidth: number;
    /** The "route" of the last selected library (empty string selects the default). */
    lastSelectedLibrary: string;
    /** What property to order the games by. */
    gamesOrderBy: GameOrderBy;
    /** What order the games should appear in. */
    gamesOrder: GameOrderReverse;
    /** Position and size of the main window. */
    mainWindow: IAppPreferencesDataMainWindow;
    /** Sources to show/hide in the log page. */
    showLogSource: {
        [key: string]: boolean;
    };
    /** Play game music */
    gameMusicPlay: boolean;
    /** Game music volume */
    gameMusicVolume: number;
};

export type IAppPreferencesDataMainWindow = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    maximized: boolean;
};
