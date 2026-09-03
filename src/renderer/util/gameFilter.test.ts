import { AdvancedFilter } from "@renderer/redux/searchSlice";
import { IGameInfo } from "@shared/game/interfaces";
import { GameFilter } from "@shared/interfaces";
import { getDefaultGameFilter } from "@shared/utils/search";
import { filterGames } from "./gameFilter";
import {
    isGameFilterEmpty,
    mergeGameFilters,
    parseAdvancedFilter,
    parseUserInput,
} from "./search";

function makeGame(overrides: Partial<IGameInfo> = {}): IGameInfo {
    return {
        id: "id",
        title: "",
        convertedTitle: "",
        alternateTitles: "",
        series: "",
        developer: "",
        publisher: "",
        dateAdded: "",
        platform: "MS-DOS",
        playMode: "",
        status: "",
        notes: "",
        genre: "",
        source: "",
        applicationPath: "",
        rootFolder: "",
        launchCommand: "",
        releaseYear: "",
        version: "",
        originalDescription: "",
        language: "",
        favorite: false,
        region: "",
        rating: "",
        library: "",
        orderTitle: "",
        placeholder: false,
        manualPath: "",
        musicPath: "",
        thumbnailPath: "",
        configurationPath: "",
        installed: false,
        media: { images: {}, video: "" },
        ...overrides,
    };
}

// eXoDOS stores LaunchBox's raw <ReleaseDate>, not a bare year
function release(year: number): string {
    return `${year}-01-01T00:00:00-06:00`;
}

const g1988 = makeGame({ id: "1988", title: "Eighty Eight", releaseYear: release(1988) });
const g1989 = makeGame({ id: "1989", title: "Eighty Nine", releaseYear: release(1989) });
const g1990 = makeGame({ id: "1990", title: "Ninety", releaseYear: release(1990) });
const g1996 = makeGame({ id: "1996", title: "Ninety Six", releaseYear: release(1996) });
const gNoYear = makeGame({ id: "none", title: "Undated", releaseYear: "" });

const yearGames = [g1988, g1989, g1990, g1996, gNoYear];

function idsFor(query: string, games: IGameInfo[] = yearGames): string[] {
    return filterGames(games, parseUserInput(query))
    .map((g) => g.id)
    .sort();
}

describe("release year comparisons", () => {
    it("treats > as strictly after the given year", () => {
        expect(idsFor("year>1989")).toEqual(["1990", "1996"]);
    });

    it("treats < as strictly before the given year", () => {
        expect(idsFor("year<1990")).toEqual(["1988", "1989"]);
    });

    it("makes > and < symmetric about the boundary year", () => {
        expect(idsFor("year>1990")).toEqual(["1996"]);
        expect(idsFor("year<1989")).toEqual(["1988"]);
    });

    it("matches a single year with year:NNNN", () => {
        expect(idsFor("year:1989")).toEqual(["1989"]);
    });

    it("matches a single year with year=NNNN", () => {
        expect(idsFor("year=1989")).toEqual(["1989"]);
    });

    it("does not return everything for a year that no game has", () => {
        expect(idsFor("year:1970")).toEqual([]);
    });
});

describe("games with no release date", () => {
    it("is excluded from year< queries rather than treated as year zero", () => {
        expect(idsFor("year<1990")).not.toContain("none");
    });

    it("is excluded from year> queries", () => {
        expect(idsFor("year>1900")).not.toContain("none");
    });

    it("is excluded from year: queries", () => {
        expect(idsFor("year:1989")).not.toContain("none");
    });
});

describe("multiple comparisons in one query", () => {
    const solo1990 = makeGame({ id: "solo", releaseYear: release(1990), maxPlayers: 1 });
    const party1990 = makeGame({ id: "party", releaseYear: release(1990), maxPlayers: 4 });
    const party1980 = makeGame({ id: "old-party", releaseYear: release(1980), maxPlayers: 4 });
    const games = [solo1990, party1990, party1980];

    it("applies both the year and the player comparison", () => {
        expect(idsFor("year>1985 players>2", games)).toEqual(["party"]);
    });

    it("applies the player comparison regardless of term order", () => {
        expect(idsFor("players>2 year>1985", games)).toEqual(["party"]);
    });

    it("applies both bounds of a less-than pair", () => {
        expect(idsFor("year<1985 players<5", games)).toEqual(["old-party"]);
    });
});

describe("matchAny with generic terms", () => {
    it("returns games matching any generic term", () => {
        const monkey = makeGame({ id: "monkey", title: "Monkey Island" });
        const larry = makeGame({ id: "larry", title: "Leisure Suit Larry" });
        const doom = makeGame({ id: "doom", title: "Doom" });

        const filter = getDefaultGameFilter();
        filter.matchAny = true;
        filter.whitelist.generic = ["monkey", "larry"];

        const result = filterGames([monkey, larry, doom], filter)
        .map((g) => g.id)
        .sort();
        expect(result).toEqual(["larry", "monkey"]);
    });

    it("returns games matching any exact generic term", () => {
        const monkey = makeGame({ id: "monkey", title: "Monkey Island" });
        const doom = makeGame({ id: "doom", title: "Doom" });

        const filter = getDefaultGameFilter();
        filter.matchAny = true;
        filter.exactWhitelist.generic = ["doom"];

        expect(filterGames([monkey, doom], filter).map((g) => g.id)).toEqual([
            "doom",
        ]);
    });
});

describe("a query combined with a toolbar filter", () => {
    const emptyAdvancedFilter: AdvancedFilter = {
        installed: undefined,
        favorite: undefined,
        series: [],
        developer: [],
        publisher: [],
        genre: [],
        playMode: [],
        region: [],
        releaseYear: [],
        rating: [],
    };

    // Mirrors createFilter() in searchSlice.ts, which cannot be imported
    // without the Electron window.External bridge.
    function createFilter(text: string, advanced: AdvancedFilter): GameFilter {
        let newFilter = parseUserInput(text);
        const advFilter = parseAdvancedFilter(advanced);
        if (!isGameFilterEmpty(advFilter)) {
            newFilter = isGameFilterEmpty(newFilter)
                ? advFilter
                : mergeGameFilters(advFilter, newFilter);
        }
        return newFilter;
    }

    const mature1985 = makeGame({ id: "m1985", rating: "M - Mature", releaseYear: release(1985) });
    const mature1995 = makeGame({ id: "m1995", rating: "M - Mature", releaseYear: release(1995) });
    const everyone1995 = makeGame({ id: "e1995", rating: "E - Everyone", releaseYear: release(1995) });
    const games = [mature1985, mature1995, everyone1995];
    const mature = { ...emptyAdvancedFilter, rating: ["M - Mature"] };

    function ids(text: string, advanced: AdvancedFilter): string[] {
        return filterGames(games, createFilter(text, advanced)).map((g) => g.id).sort();
    }

    it("keeps a comparison-only query when a rating is selected", () => {
        expect(ids("year>1990", mature)).toEqual(["m1995"]);
    });

    it("keeps the opposite comparison too", () => {
        expect(ids("year<1990", mature)).toEqual(["m1985"]);
    });

    it("does not let contradictory queries return the same games", () => {
        expect(ids("year>1990", mature)).not.toEqual(ids("year<1990", mature));
    });

    it("still applies the toolbar filter on its own", () => {
        expect(ids("", mature)).toEqual(["m1985", "m1995"]);
    });

    it("keeps a quoted phrase when a rating is selected", () => {
        const titled = makeGame({ id: "t", rating: "M - Mature", title: "Monkey Island" });
        const other = makeGame({ id: "o", rating: "M - Mature", title: "Doom" });
        const result = filterGames(
            [titled, other],
            createFilter("\"Monkey Island\"", mature)
        );
        expect(result.map((g) => g.id)).toEqual(["t"]);
    });
});

describe("quoted alternatives", () => {
    const sierra = makeGame({ id: "sierra", publisher: "Sierra Entertainment" });
    const lucas = makeGame({ id: "lucas", publisher: "LucasArts Games" });
    const sierraInc = makeGame({
        id: "sierra-inc",
        publisher: "Sierra Entertainment, Inc.",
    });
    const games = [sierra, lucas, sierraInc];

    it("matches either publisher exactly", () => {
        expect(
            idsFor("pub=\"Sierra Entertainment\",\"Lucasarts Games\"", games)
        ).toEqual(["lucas", "sierra"]);
    });

    it("matches either publisher partially with the : key character", () => {
        expect(
            idsFor("pub:\"Sierra Entertainment\",\"Lucasarts Games\"", games)
        ).toEqual(["lucas", "sierra", "sierra-inc"]);
    });

    it("excludes both publishers when negated", () => {
        expect(
            idsFor("-pub=\"Sierra Entertainment\",\"Lucasarts Games\"", games)
        ).toEqual(["sierra-inc"]);
    });
});
