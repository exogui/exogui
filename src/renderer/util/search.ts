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

const KEY_CHARS = ["=", ":", "<", ">"];

const REPLACEMENT = "awgdty7awgvbduiawdjnujioawd888";

export function parseUserInput(input: string): GameFilter {
    const filter = getDefaultGameFilter();

    let capturingQuotes = false;
    let workingKey = "";
    let workingValue = "";
    let workingKeyChar: KeyChar | undefined = undefined;
    let negative = false;
    let quoted = false;

    const commit = () => {
        let exact = false;
        if (workingKey) {
            if (workingValue == REPLACEMENT) {
                workingValue = ""; // Empty it again now we're at the end
                exact = true;
            } else if (workingKeyChar === KeyChar.EQUALS) {
                exact = true;
            }
        }

        const value = workingValue;
        let processed = true;

        switch (workingKeyChar) {
            case KeyChar.LESS_THAN: {
                switch (workingKey) {
                    case "players":
                    case "maxPlayers": {
                        filter.lessThan.maxPlayers = Number(value);
                        break;
                    }
                    case "release":
                    case "releaseDate":
                    case "releaseYear":
                    case "year": {
                        filter.lessThan.releaseYear = value;
                        break;
                    }
                    default: {
                        processed = false;
                    }
                }
                break;
            }
            case KeyChar.GREATER_THAN: {
                switch (workingKey) {
                    case "players":
                    case "maxPlayers": {
                        filter.greaterThan.maxPlayers = Number(value);
                        break;
                    }
                    case "release":
                    case "releaseDate":
                    case "releaseYear":
                    case "year": {
                        filter.greaterThan.releaseYear = value;
                        break;
                    }
                    default: {
                        processed = false;
                    }
                }
                break;
            }
            case KeyChar.EQUALS:
            case KeyChar.MATCHES: {
                switch (workingKey) {
                    case "players":
                    case "maxPlayers": {
                        filter.equalTo.maxPlayers = Number(value);
                        break;
                    }
                    case "release":
                    case "releaseDate":
                    case "releaseYear":
                    case "year": {
                        filter.equalTo.releaseYear = value;
                        break;
                    }
                    default: {
                        processed = false;
                    }
                }
                break;
            }
            default: {
                processed = false;
            }
        }

        if (!processed) {
            const field = fieldForKey(workingKey);

            if (field !== undefined) {
                addValues(filter, field, value, negative, exact, quoted);
            } else if (!workingKeyChar && value.toLowerCase() === "installed") {
                // Cheat a little and assume nobody is writing installed or favorite as a value
                filter.booleans.installed = !negative;
            } else if (!workingKeyChar && value.toLowerCase() === "favorite") {
                filter.booleans.favorite = !negative;
            } else {
                if (workingKey) {
                    console.warn(
                        `Unrecognized search key "${workingKey}", matching it as plain text instead`
                    );
                }
                const fullValue = workingKeyChar
                    ? workingKey + workingKeyChar + value
                    : value;
                addValues(filter, "generic", fullValue, negative, exact, quoted);
            }
        }

        negative = false;
        quoted = false;
        workingValue = "";
        workingKey = "";
        workingKeyChar = undefined;
    };

    for (let token of input.split(" ")) {
        if (!capturingQuotes && token.length > 1) {
            // Check for "-" negation
            if (token.startsWith("-")) {
                negative = true;

                token = token.slice(1);
            }

            // Check for quick search shortcuts
            if (token.length > 1) {
                const ch = token[0];
                switch (ch) {
                    case "#": {
                        token = token.slice(1);
                        workingKey = "genre";
                        break;
                    }
                    case "!": {
                        token = token.slice(1);
                        workingKey = "platform";
                        break;
                    }
                    case "@": {
                        token = token.slice(1);
                        workingKey = "developer";
                        break;
                    }
                }
            }
        }

        // Opening quotes check
        if (token.startsWith("\"")) {
            token = token.slice(1);
            capturingQuotes = true;
            quoted = true;
        }

        if (capturingQuotes) {
            // Inside quotes, add to working value
            if (workingValue == "") {
                workingValue = token;
            } else {
                workingValue += ` ${token}`;
            }
        }

        // Closing quotes check
        if (token.endsWith("\"") && capturingQuotes) {
            capturingQuotes = false;
            // Remove quote at end of working value, if doesn't exist then it's a broken quoted value
            const suffixIdx = workingValue.lastIndexOf("\"");
            if (suffixIdx > -1) {
                workingValue = workingValue.slice(0, suffixIdx);
            }
        }

        if (capturingQuotes) {
            // Still inside quotes, keep parsing rest of tokens
            continue;
        }

        // Try parsing what we have left into a proper key value pair
        if (!workingValue) {
            workingKeyChar = getKeyChar(token);

            if (workingKeyChar) {
                const parts = token.split(workingKeyChar);
                if (parts.length > 1) {
                    workingKey = parts[0];
                    token = parts.slice(1).join(workingKeyChar);
                }
            }

            // Entire token is wrapped, must be a generic value
            if (token.endsWith("\"") && token.startsWith("\"")) {
                quoted = true;
                if (token.length == 2) {
                    if (workingKey !== "") {
                        // It has a key? Must be a deliberately empty value, fill with a replacement string for now
                        workingValue = REPLACEMENT;
                    }
                } else {
                    token = token.slice(1, token.length - 1); // Remove quotes
                    workingValue = token;
                }
                // Opening quote, but no key yet, must be the start of a spaced generic value
            } else {
                if (token.startsWith("\"")) {
                    token = token.slice(1);
                    capturingQuotes = true;
                    quoted = true;
                    workingValue = token;
                    continue;
                }
                workingValue = token;
            }
        }

        if (workingValue) {
            commit();
        }
    }

    // An unterminated quote still holds a value - keep it rather than dropping the whole query
    if (workingValue) {
        commit();
    }

    return filter;
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

/** A comma separated value means "any of these"; quoting it keeps the commas literal. */
function splitAlternatives(value: string, quoted: boolean): string[] {
    if (quoted || value === "") {
        return [value];
    }
    const parts = value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");
    return parts.length > 0 ? parts : [value];
}

function addValues(
    filter: GameFilter,
    field: keyof FieldFilter,
    value: string,
    negative: boolean,
    exact: boolean,
    quoted: boolean
) {
    const values = splitAlternatives(value, quoted);

    if (values.length > 1) {
        const anyFilter = getDefaultGameFilter();
        anyFilter.matchAny = true;
        listFor(anyFilter, negative, exact)[field].push(...values);
        filter.subfilters.push(anyFilter);
    } else {
        listFor(filter, negative, exact)[field].push(values[0]);
    }
}

function getKeyChar(token: string): KeyChar | undefined {
    let earliestPos = 9999999;
    let earliestKeyChar = "";

    for (const keyChar of KEY_CHARS) {
        const idx = token.indexOf(keyChar);
        if (idx < earliestPos && idx > -1) {
            earliestPos = idx;
            earliestKeyChar = keyChar;
        }
    }

    switch (earliestKeyChar) {
        case "=":
            return KeyChar.EQUALS;
        case ":":
            return KeyChar.MATCHES;
        case ">":
            return KeyChar.GREATER_THAN;
        case "<":
            return KeyChar.LESS_THAN;
        default:
            return undefined;
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
