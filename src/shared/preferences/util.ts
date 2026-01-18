import { BackIn } from "../back/types";
import { BrowsePageLayout } from "../BrowsePageLayout";
import { DeepPartial } from "../interfaces";
import { gameOrderByOptions, gameOrderReverseOptions } from "../order/util";
import { deepCopy } from "../Util";
import { Coerce } from "../utils/Coerce";
import { IObjectParserProp, ObjectParser } from "../utils/ObjectParser";
import {
    IAppPreferencesData,
    IAppPreferencesDataMainWindow,
} from "./interfaces";

export function updatePreferencesData(
    data: DeepPartial<IAppPreferencesData>,
    send: boolean = true
) {
    const preferences = window.External.preferences;
    // @TODO Figure out the delta change of the object tree, and only send the changes
    preferences.data = overwritePreferenceData(
        deepCopy(preferences.data),
        data
    );
    if (preferences.onUpdate) {
        preferences.onUpdate();
    }
    if (send) {
        window.External.back.send(BackIn.UPDATE_PREFERENCES, preferences.data);
    }
}

const { num, str } = Coerce;

/** Default Preferences Data used for values that are not found in the file */
export const defaultPreferencesData: Readonly<IAppPreferencesData> =
    Object.freeze<IAppPreferencesData>({
        browsePageGameScale: 0.087,
        browsePageLayout: BrowsePageLayout.grid,
        browsePageShowLeftSidebar: true,
        browsePageShowRightSidebar: true,
        browsePageLeftSidebarWidth: 320,
        browsePageRightSidebarWidth: 320,
        lastSelectedLibrary: "",
        gamesOrderBy: "title",
        gamesOrder: "ascending",
        mainWindow: Object.freeze({
            x: undefined,
            y: undefined,
            width: undefined,
            height: undefined,
            maximized: false,
        }),
        showLogSource: Object.freeze({
            // (Add log sources that should be hidden by default here)
        }),
        gameMusicPlay: true,
        gameMusicVolume: 0.5,
    });

/**
 * Overwrite a preferences data object with data from another object.
 * @param source Object to overwrite.
 * @param data Object with data to overwrite the source with.
 * @returns Source argument (not a copy).
 */
export function overwritePreferenceData(
    source: IAppPreferencesData,
    data: DeepPartial<IAppPreferencesData>,
    onError?: (error: string) => void
): IAppPreferencesData {
    const parser = new ObjectParser({
        input: data,
        onError:
            onError &&
            ((e) =>
                onError(`Error while parsing Preferences: ${e.toString()}`)),
    });
    // Parse root object
    parser.prop(
        "browsePageGameScale",
        (v) => (source.browsePageGameScale = num(v))
    );
    parser.prop("browsePageLayout", (v) => (source.browsePageLayout = num(v)));
    parser.prop(
        "browsePageShowLeftSidebar",
        (v) => (source.browsePageShowLeftSidebar = !!v)
    );
    parser.prop(
        "browsePageShowRightSidebar",
        (v) => (source.browsePageShowRightSidebar = !!v)
    );
    parser.prop(
        "browsePageLeftSidebarWidth",
        (v) => (source.browsePageLeftSidebarWidth = num(v))
    );
    parser.prop(
        "browsePageRightSidebarWidth",
        (v) => (source.browsePageRightSidebarWidth = num(v))
    );
    parser.prop(
        "lastSelectedLibrary",
        (v) => (source.lastSelectedLibrary = str(v))
    );
    parser.prop(
        "gamesOrderBy",
        (v) => (source.gamesOrderBy = strOpt(v, gameOrderByOptions, "title"))
    );
    parser.prop(
        "gamesOrder",
        (v) =>
            (source.gamesOrder = strOpt(
                v,
                gameOrderReverseOptions,
                "ascending"
            ))
    );
    parser.prop("gameMusicVolume", (v) => (source.gameMusicVolume = num(v)), true);
    parser.prop("gameMusicPlay", (v) => (source.gameMusicPlay = !!v), true);
    // Parse window object
    parseMainWindow(parser.prop("mainWindow"), source.mainWindow);
    parser
    .prop("showLogSource")
    .mapRaw((item, label) => (source.showLogSource[label] = !!item));
    // Done
    return source;
}

function parseMainWindow(
    parser: IObjectParserProp<any>,
    output: IAppPreferencesDataMainWindow
): void {
    parser.prop("x", (v) => (output.x = num(v)), true);
    parser.prop("y", (v) => (output.y = num(v)), true);
    parser.prop("width", (v) => (output.width = num(v)), true);
    parser.prop("height", (v) => (output.height = num(v)), true);
    parser.prop("maximized", (v) => (output.maximized = !!v));
}

/**
 * Coerce a value to a string, then return it if it matches at least on of the options.
 * If it does not match any option, the default option is returned.
 * @param value Value to coerce.
 * @param options Options the value must match at least one of.
 * @param defaultOption This is returned if the value doesn't match any of the options.
 */
function strOpt<T extends string>(
    value: any,
    options: T[],
    defaultOption: T
): T {
    value = str(value);
    for (const option of options) {
        if (value === option) {
            return value;
        }
    }
    return defaultOption;
}
