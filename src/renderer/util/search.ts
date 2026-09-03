import { AdvancedFilter } from "@renderer/redux/searchSlice";
import {
    BooleanFilter,
    CompareFilter,
    FieldFilter,
    GameFilter,
} from "@shared/interfaces";
import { getDefaultGameFilter } from "@shared/utils/search";

enum KeyChar {
    MATCHES = ":",
    EQUALS = "=",
    LESS_THAN = "<",
    GREATER_THAN = ">",
}

const KEY_CHARS: string[] = [
    KeyChar.EQUALS,
    KeyChar.MATCHES,
    KeyChar.LESS_THAN,
    KeyChar.GREATER_THAN,
];

const QUOTE = "\"";

const SHORTCUT_KEYS: Record<string, string> = {
    "#": "genre",
    "!": "platform",
    "@": "developer",
};

/** One alternative of a value, remembering whether the user quoted it. */
type ValuePart = {
    value: string;
    quoted: boolean;
};

export function parseUserInput(input: string): GameFilter {
    const filter = getDefaultGameFilter();

    for (const token of splitTokens(input)) {
        applyToken(filter, token);
    }

    return filter;
}

function applyToken(filter: GameFilter, token: string) {
    let rest = token;
    let negative = false;
    let key = "";

    if (rest.length > 1 && rest.startsWith("-")) {
        negative = true;
        rest = rest.slice(1);
    }

    if (rest.length > 1 && SHORTCUT_KEYS[rest[0]]) {
        key = SHORTCUT_KEYS[rest[0]];
        rest = rest.slice(1);
    }

    let keyChar: KeyChar | undefined = undefined;
    const keyCharIndex = findKeyChar(rest);
    if (keyCharIndex > -1) {
        keyChar = rest[keyCharIndex] as KeyChar;
        key = rest.slice(0, keyCharIndex);
        rest = rest.slice(keyCharIndex + 1);
    }

    const parts = splitValues(rest);
    const values = (
        parts.length > 1 ? parts.filter((part) => part.value !== "") : parts
    ).map((part) => part.value);

    if (values.length === 0) {
        return;
    }

    if (keyChar && applyComparison(filter, key, keyChar, values.join(","))) {
        return;
    }

    const exact =
        key !== "" && (keyChar === KeyChar.EQUALS || isDeliberatelyEmpty(parts));
    const field = fieldForKey(key);

    if (field !== undefined) {
        addValues(filter, field, values, negative, exact);
        return;
    }

    if (!keyChar && values.length === 1) {
        // Cheat a little and assume nobody is writing installed or favorite as a value
        switch (values[0].toLowerCase()) {
            case "installed": {
                filter.booleans.installed = !negative;
                return;
            }
            case "favorite": {
                filter.booleans.favorite = !negative;
                return;
            }
        }
    }

    if (key) {
        console.warn(
            `Unrecognized search key "${key}", matching it as plain text instead`
        );
    }

    if (keyChar) {
        values[0] = key + keyChar + values[0];
    }
    addValues(filter, "generic", values, negative, exact);
}

/** Splits on spaces, except inside quotes, so a quoted value keeps its spaces. */
function splitTokens(input: string): string[] {
    const tokens: string[] = [];
    let token = "";
    let insideQuotes = false;

    for (const char of input) {
        if (char === QUOTE) {
            insideQuotes = !insideQuotes;
            token += char;
        } else if (char === " " && !insideQuotes) {
            if (token) {
                tokens.push(token);
                token = "";
            }
        } else {
            token += char;
        }
    }

    if (token) {
        tokens.push(token);
    }

    return tokens;
}

/**
 * A comma separated value means "any of these". Every alternative can carry its
 * own quotes (pub="Sierra On-Line","LucasArts Entertainment"), so quotes group
 * only the alternative they wrap and the commas inside them stay literal.
 */
function splitValues(value: string): ValuePart[] {
    const parts: ValuePart[] = [];
    let part = "";
    let quoted = false;
    let insideQuotes = false;

    const commitPart = () => {
        const trimmed = quoted ? part : part.trim();
        if (trimmed !== "" || quoted) {
            parts.push({ value: trimmed, quoted });
        }
        part = "";
        quoted = false;
    };

    for (const char of value) {
        if (char === QUOTE) {
            insideQuotes = !insideQuotes;
            quoted = true;
        } else if (char === "," && !insideQuotes) {
            commitPart();
        } else {
            part += char;
        }
    }
    commitPart();

    return parts;
}

/** The key ends at the first key character, but only if no quote opened first. */
function findKeyChar(token: string): number {
    for (let i = 0; i < token.length; i++) {
        if (token[i] === QUOTE) {
            return -1;
        }
        if (KEY_CHARS.includes(token[i])) {
            return i;
        }
    }

    return -1;
}

/** pub="" asks for games with no publisher, which only an exact match can answer. */
function isDeliberatelyEmpty(parts: ValuePart[]): boolean {
    return parts.length === 1 && parts[0].quoted && parts[0].value === "";
}

function comparisonFor(
    filter: GameFilter,
    keyChar: KeyChar
): CompareFilter | undefined {
    switch (keyChar) {
        case KeyChar.LESS_THAN:
            return filter.lessThan;
        case KeyChar.GREATER_THAN:
            return filter.greaterThan;
        case KeyChar.EQUALS:
        case KeyChar.MATCHES:
            return filter.equalTo;
        default:
            return undefined;
    }
}

function applyComparison(
    filter: GameFilter,
    key: string,
    keyChar: KeyChar,
    value: string
): boolean {
    const comparison = comparisonFor(filter, keyChar);
    if (comparison === undefined) {
        return false;
    }

    switch (key) {
        case "players":
        case "maxPlayers": {
            comparison.maxPlayers = Number(value);
            return true;
        }
        case "release":
        case "releaseDate":
        case "releaseYear":
        case "year": {
            comparison.releaseYear = value;
            return true;
        }
        default: {
            return false;
        }
    }
}

function fieldForKey(key: string): keyof FieldFilter | undefined {
    switch (key.toLowerCase()) {
        case "id":
            return "id";
        case "title":
            return "title";
        case "series":
            return "series";
        case "dev":
        case "developer":
            return "developer";
        case "pub":
        case "publisher":
            return "publisher";
        case "platform":
            return "platform";
        case "tag":
        case "genre":
            return "genre";
        case "playmode":
        case "play_mode":
            return "playMode";
        case "region":
            return "region";
        case "rating":
            return "rating";
        default:
            return undefined;
    }
}

function listFor(
    filter: GameFilter,
    negative: boolean,
    exact: boolean
): FieldFilter {
    if (negative) {
        return exact ? filter.exactBlacklist : filter.blacklist;
    }
    return exact ? filter.exactWhitelist : filter.whitelist;
}

function addValues(
    filter: GameFilter,
    field: keyof FieldFilter,
    values: string[],
    negative: boolean,
    exact: boolean
) {
    if (values.length > 1) {
        const anyFilter = getDefaultGameFilter();
        anyFilter.matchAny = true;
        listFor(anyFilter, negative, exact)[field].push(...values);
        filter.subfilters.push(anyFilter);
    } else {
        listFor(filter, negative, exact)[field].push(values[0]);
    }
}

export function mergeGameFilters(a: GameFilter, b: GameFilter): GameFilter {
    const newFilter = getDefaultGameFilter();
    newFilter.subfilters = [a, b];

    // If both are match any, then we can match either filter as well
    // If either are match all, then both filter conditions must return true
    if (a.matchAny && b.matchAny) {
        newFilter.matchAny = true;
    }

    return newFilter;
}

export function isGameFilterEmpty(filter: GameFilter) {
    return (
        filter.subfilters.length === 0 &&
        isFilterEmpty(filter.whitelist) &&
        isFilterEmpty(filter.blacklist) &&
        isFilterEmpty(filter.exactWhitelist) &&
        isFilterEmpty(filter.exactBlacklist) &&
        isBooleanFilterEmpty(filter.booleans) &&
        isCompareFilterEmpty(filter.equalTo) &&
        isCompareFilterEmpty(filter.greaterThan) &&
        isCompareFilterEmpty(filter.lessThan)
    );
}

export function isFilterEmpty(filter: FieldFilter) {
    return !(
        filter.generic.length > 0 ||
        filter.id.length > 0 ||
        filter.title.length > 0 ||
        filter.series.length > 0 ||
        filter.developer.length > 0 ||
        filter.publisher.length > 0 ||
        filter.platform.length > 0 ||
        filter.genre.length > 0 ||
        filter.playMode.length > 0 ||
        filter.region.length > 0 ||
        filter.releaseYear.length > 0 ||
        filter.rating.length > 0
    );
}

export function isCompareFilterEmpty(filter: CompareFilter) {
    return !(
        filter.maxPlayers !== undefined || filter.releaseYear !== undefined
    );
}

export function isBooleanFilterEmpty(filter: BooleanFilter) {
    return !(
        filter.installed !== undefined || filter.favorite !== undefined
    );
}

export function parseAdvancedFilter(filter: AdvancedFilter): GameFilter {
    const newFilter = getDefaultGameFilter();

    newFilter.booleans.installed = filter.installed;
    newFilter.booleans.favorite = filter.favorite;

    if (filter.developer.length > 0) {
        const developerFilter = getDefaultGameFilter();
        developerFilter.matchAny = true;
        developerFilter.whitelist.developer = filter.developer.filter(
            (s) => s !== ""
        );
        developerFilter.exactWhitelist.developer = filter.developer.filter(
            (s) => s === ""
        );
        newFilter.subfilters.push(developerFilter);
    }

    if (filter.publisher.length > 0) {
        const publisherFilter = getDefaultGameFilter();
        publisherFilter.matchAny = true;
        publisherFilter.whitelist.publisher = filter.publisher.filter(
            (s) => s !== ""
        );
        publisherFilter.exactWhitelist.publisher = filter.publisher.filter(
            (s) => s === ""
        );
        newFilter.subfilters.push(publisherFilter);
    }

    if (filter.series.length > 0) {
        const seriesFilter = getDefaultGameFilter();
        seriesFilter.matchAny = true;
        seriesFilter.whitelist.series = filter.series.filter((s) => s !== "");
        seriesFilter.exactWhitelist.series = filter.series.filter(
            (s) => s === ""
        );
        newFilter.subfilters.push(seriesFilter);
    }

    if (filter.genre.length > 0) {
        const genreFilter = getDefaultGameFilter();
        genreFilter.matchAny = true;
        genreFilter.whitelist.genre = filter.genre.filter((s) => s !== "");
        genreFilter.exactWhitelist.genre = filter.genre.filter((s) => s === "");
        newFilter.subfilters.push(genreFilter);
    }

    if (filter.playMode.length > 0) {
        const playModeFilter = getDefaultGameFilter();
        playModeFilter.matchAny = true;
        playModeFilter.whitelist.playMode = filter.playMode.filter(
            (s) => s !== ""
        );
        playModeFilter.exactWhitelist.playMode = filter.playMode.filter(
            (s) => s === ""
        );
        newFilter.subfilters.push(playModeFilter);
    }

    if (filter.region.length > 0) {
        const regionFilter = getDefaultGameFilter();
        regionFilter.matchAny = true;
        regionFilter.whitelist.region = filter.region.filter((s) => s !== "");
        regionFilter.exactWhitelist.region = filter.region.filter(
            (s) => s === ""
        );
        newFilter.subfilters.push(regionFilter);
    }

    if (filter.rating.length > 0) {
        const ratingFilter = getDefaultGameFilter();
        ratingFilter.matchAny = true;
        ratingFilter.whitelist.rating = filter.rating.filter((s) => s !== "");
        ratingFilter.exactWhitelist.rating = filter.rating.filter(
            (s) => s === ""
        );
        newFilter.subfilters.push(ratingFilter);
    }

    if (filter.releaseYear.length > 0) {
        const releaseYearFilter = getDefaultGameFilter();
        releaseYearFilter.matchAny = true;
        releaseYearFilter.whitelist.releaseYear = filter.releaseYear.filter(
            (s) => s !== ""
        );
        releaseYearFilter.exactWhitelist.releaseYear = filter.releaseYear.filter(
            (s) => s === ""
        );
        newFilter.subfilters.push(releaseYearFilter);
    }

    return newFilter;
}
