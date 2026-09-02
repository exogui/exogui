import {
    isBooleanFilterEmpty,
    isCompareFilterEmpty,
    isFilterEmpty,
} from "@renderer/util/search";
import { IGameInfo } from "@shared/game/interfaces";
import {
    BooleanFilter,
    CompareFilter,
    FieldFilter,
    GameFilter,
} from "@shared/interfaces";

export function filterGames(
    games: IGameInfo[],
    filter: GameFilter
): IGameInfo[] {
    let newGames = [...games];

    // Handle subfilters
    if (filter.subfilters.length > 0) {
        if (!filter.matchAny) {
            // Get join of all subfilters for an AND
            const subfilteredGames = filter.subfilters.map((f) =>
                filterGames(newGames, f)
            );

            // Get the intersection of all id sets
            const commonIds = subfilteredGames.reduce((acc, array) => {
                const ids = new Set(array.map((obj) => obj.id));
                return new Set([...acc].filter((id) => ids.has(id)));
            }, new Set(subfilteredGames[0].map((obj) => obj.id)));

            // Filter objects based on the common ids
            newGames = subfilteredGames[0].filter((obj) =>
                commonIds.has(obj.id)
            );
        } else {
            // Join all members of the subfilter for OR
            const subfilteredGames = filter.subfilters.flatMap((f) =>
                filterGames(newGames, f)
            );
            const uniqueItemsMap: Map<string, IGameInfo> = new Map();

            for (const game of subfilteredGames) {
                if (!uniqueItemsMap.has(game.id)) {
                    uniqueItemsMap.set(game.id, game);
                }
            }

            newGames = Array.from(uniqueItemsMap.values());
        }
    }

    // Handle own filter

    if (!isBooleanFilterEmpty(filter.booleans)) {
        const filterFunc = booleanFilterFactory(
            filter.booleans,
            filter.matchAny
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isFilterEmpty(filter.exactWhitelist)) {
        const filterFunc = exactStringFilterFieldFactory(
            filter.exactWhitelist,
            filter.matchAny
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isFilterEmpty(filter.exactBlacklist)) {
        const filterFunc = not(
            exactStringFilterFieldFactory(
                filter.exactBlacklist,
                filter.matchAny
            )
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isFilterEmpty(filter.whitelist)) {
        const filterFunc = fuzzyStringFilterFieldFactory(
            filter.whitelist,
            filter.matchAny
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isFilterEmpty(filter.blacklist)) {
        const filterFunc = not(
            fuzzyStringFilterFieldFactory(filter.blacklist, filter.matchAny)
        );
        newGames = newGames.filter(filterFunc);
    }

    if (!isCompareFilterEmpty(filter.equalTo)) {
        const filterFunc = equalToFilterFactory(filter.equalTo);
        newGames = newGames.filter(filterFunc);
    }

    if (!isCompareFilterEmpty(filter.greaterThan)) {
        const filterFunc = greaterThanFilterFactory(filter.greaterThan);
        newGames = newGames.filter(filterFunc);
    }

    if (!isCompareFilterEmpty(filter.lessThan)) {
        const filterFunc = lessThanFilterFactory(filter.lessThan);
        newGames = newGames.filter(filterFunc);
    }

    return newGames;
}

function lowerCaseFilter(filter: FieldFilter): FieldFilter {
    return {
        generic: filter.generic.map((s) => s.toLowerCase()),
        id: filter.id.map((s) => s.toLowerCase()),
        title: filter.title.map((s) => s.toLowerCase()),
        series: filter.series.map((s) => s.toLowerCase()),
        developer: filter.developer.map((s) => s.toLowerCase()),
        publisher: filter.publisher.map((s) => s.toLowerCase()),
        platform: filter.platform.map((s) => s.toLowerCase()),
        genre: filter.genre.map((s) => s.toLowerCase()),
        playMode: filter.playMode.map((s) => s.toLowerCase()),
        region: filter.region.map((s) => s.toLowerCase()),
        rating: filter.rating.map((s) => s.toLowerCase()),
        releaseYear: filter.releaseYear,
    };
}

function not<T extends any[]>(func: (...args: T) => boolean) {
    return (...args: T) => {
        return !func(...args);
    };
}

const fieldFilterKeys: Array<keyof FieldFilter> = [
    "id",
    "title",
    "series",
    "developer",
    "publisher",
    "platform",
    "genre",
    "playMode",
    "region",
    "rating",
    "releaseYear",
];

const booleanFilterKeys: Array<keyof BooleanFilter> = [
    "installed",
    "favorite",
];

const compareFilterKeys: Array<keyof CompareFilter> = [
    "releaseYear",
    "maxPlayers",
];

export function exactStringFilterFieldFactory(
    filter: FieldFilter,
    matchAny: boolean
) {
    filter = lowerCaseFilter(filter);

    return (game: IGameInfo) => {
        // Compare generic keys against a few different fields
        if (filter.generic.length > 0) {
            if (!matchAny) {
                for (const val of filter.generic) {
                    if (
                        game.title.toLowerCase() !== val &&
                        game.series.toLowerCase() !== val &&
                        game.developer.toLowerCase() !== val &&
                        game.publisher.toLowerCase() !== val
                    ) {
                        return false;
                    }
                }
            } else {
                for (const val of filter.generic) {
                    if (
                        game.title.toLowerCase() === val ||
                        game.series.toLowerCase() === val ||
                        game.developer.toLowerCase() === val ||
                        game.publisher.toLowerCase() === val
                    ) {
                        return true;
                    }
                }
            }
        }

        // Compare each field that is filterable by a string
        for (const key of fieldFilterKeys) {
            if (filter[key].length > 0) {
                if (!matchAny) {
                    // Match all terms
                    for (const val of filter[key]) {
                        if (
                            !(
                                (
                                    game[key as keyof IGameInfo] as string
                                ).toLowerCase() === val
                            )
                        ) {
                            return false;
                        }
                    }
                } else {
                    // Match any term
                    for (const val of filter[key]) {
                        if (
                            (
                                game[key as keyof IGameInfo] as string
                            ).toLowerCase() === val
                        ) {
                            return true;
                        }
                    }
                }
            }
        }

        // If we made it here, we've either matched all (AND) or matched none (OR)
        return !matchAny;
    };
}

export function fuzzyStringFilterFieldFactory(
    filter: FieldFilter,
    matchAny: boolean
) {
    filter = lowerCaseFilter(filter);

    return (game: IGameInfo) => {
        // Compare generic keys against a few different fields
        if (filter.generic.length > 0) {
            if (!matchAny) {
                for (const val of filter.generic) {
                    if (
                        !game.title.toLowerCase().includes(val) &&
                        !game.series.toLowerCase().includes(val) &&
                        !game.developer.toLowerCase().includes(val) &&
                        !game.publisher.toLowerCase().includes(val)
                    ) {
                        return false;
                    }
                }
            } else {
                for (const val of filter.generic) {
                    if (
                        game.title.toLowerCase().includes(val) ||
                        game.series.toLowerCase().includes(val) ||
                        game.developer.toLowerCase().includes(val) ||
                        game.publisher.toLowerCase().includes(val)
                    ) {
                        return true;
                    }
                }
            }
        }

        // Compare each field that is filterable by a string
        for (const key of fieldFilterKeys) {
            if (filter[key].length > 0) {
                if (!matchAny) {
                    // Match all terms
                    for (const val of filter[key]) {
                        if (
                            !(game[key as keyof IGameInfo] as string)
                            .toLowerCase()
                            .includes(val)
                        ) {
                            return false;
                        }
                    }
                } else {
                    // Match any term
                    for (const val of filter[key]) {
                        if (
                            (game[key as keyof IGameInfo] as string)
                            .toLowerCase()
                            .includes(val)
                        ) {
                            return true;
                        }
                    }
                }
            }
        }

        // If we made it here, we've either matched all (AND) or matched none (OR)
        return !matchAny;
    };
}

export function booleanFilterFactory(filter: BooleanFilter, matchAny: boolean) {
    return (game: IGameInfo) => {
        // Compare each field that is filterable by a string
        for (const key of booleanFilterKeys) {
            if (filter[key] !== undefined) {
                if (!matchAny) {
                    // Match all terms
                    if (
                        !(
                            (game[key as keyof IGameInfo] as boolean) ===
                            filter[key]
                        )
                    ) {
                        return false;
                    }
                } else {
                    // Match any term
                    if (
                        (game[key as keyof IGameInfo] as boolean) ===
                        filter[key]
                    ) {
                        return true;
                    }
                }
            }
        }

        // If we made it here, we've either matched all (AND) or matched none (OR)
        return !matchAny;
    };
}

/**
 * eXoDOS stores LaunchBox's raw <ReleaseDate> ("1996-01-01T00:00:00-06:00"), so a year
 * has to be pulled out before comparing. Comparing the raw strings makes ">" behave
 * inclusively and sweeps undated games into every "<" query.
 */
const YEAR_PATTERN = /^\s*(\d{1,4})/;

function parseYear(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    const match = YEAR_PATTERN.exec(String(value));
    return match ? Number(match[1]) : undefined;
}

function comparableValues(
    game: IGameInfo,
    key: keyof CompareFilter,
    filterValue: string | number
): [number, number] | undefined {
    if (key === "releaseYear") {
        const gameYear = parseYear(game.releaseYear);
        const targetYear = parseYear(filterValue);
        if (gameYear === undefined || targetYear === undefined) {
            return undefined;
        }
        return [gameYear, targetYear];
    }

    const players = game.maxPlayers;
    const target = Number(filterValue);
    if (typeof players !== "number" || isNaN(players) || isNaN(target)) {
        return undefined;
    }
    return [players, target];
}

function compareFilterFactory(
    filter: CompareFilter,
    compare: (gameValue: number, filterValue: number) => boolean
) {
    return (game: IGameInfo) => {
        for (const key of compareFilterKeys) {
            const val = filter[key];
            if (val === undefined) {
                continue;
            }

            const values = comparableValues(game, key, val);
            if (!values || !compare(values[0], values[1])) {
                return false;
            }
        }

        return true;
    };
}

export function equalToFilterFactory(filter: CompareFilter) {
    return compareFilterFactory(filter, (a, b) => a === b);
}

export function greaterThanFilterFactory(filter: CompareFilter) {
    return compareFilterFactory(filter, (a, b) => a > b);
}

export function lessThanFilterFactory(filter: CompareFilter) {
    return compareFilterFactory(filter, (a, b) => a < b);
}
