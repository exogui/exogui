import {
    isBooleanFilterEmpty,
    isGameFilterEmpty,
    parseAdvancedFilter,
    parseUserInput,
} from "./search";

describe("isBooleanFilterEmpty", () => {
    it("returns true when no booleans are set", () => {
        expect(isBooleanFilterEmpty({})).toBe(true);
    });

    it("returns false when installed is set", () => {
        expect(isBooleanFilterEmpty({ installed: true })).toBe(false);
    });

    it("returns false when favorite is set to true", () => {
        expect(isBooleanFilterEmpty({ favorite: true })).toBe(false);
    });

    it("returns false when favorite is set to false", () => {
        expect(isBooleanFilterEmpty({ favorite: false })).toBe(false);
    });
});

const defaultAdvancedFilter = {
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

describe("parseAdvancedFilter - favorite", () => {
    it("maps favorite:true to booleans.favorite=true", () => {
        const result = parseAdvancedFilter({ ...defaultAdvancedFilter, favorite: true });
        expect(result.booleans.favorite).toBe(true);
    });

    it("maps favorite:false to booleans.favorite=false", () => {
        const result = parseAdvancedFilter({ ...defaultAdvancedFilter, favorite: false });
        expect(result.booleans.favorite).toBe(false);
    });

    it("leaves booleans.favorite undefined when filter.favorite is undefined", () => {
        const result = parseAdvancedFilter({ ...defaultAdvancedFilter, favorite: undefined });
        expect(result.booleans.favorite).toBeUndefined();
    });
});

describe("parseAdvancedFilter - releaseYear", () => {
    it("puts blank release years on the releaseYear field, not rating", () => {
        const result = parseAdvancedFilter({
            ...defaultAdvancedFilter,
            releaseYear: ["1995", ""],
        });
        const sub = result.subfilters[0];
        expect(sub.whitelist.releaseYear).toEqual(["1995"]);
        expect(sub.exactWhitelist.releaseYear).toEqual([""]);
        expect(sub.exactWhitelist.rating).toEqual([]);
    });
});

describe("isGameFilterEmpty - comparison filters", () => {
    it("is not empty for a greater-than comparison", () => {
        expect(isGameFilterEmpty(parseUserInput("year>1990"))).toBe(false);
    });

    it("is not empty for a less-than comparison", () => {
        expect(isGameFilterEmpty(parseUserInput("players<3"))).toBe(false);
    });

    it("is not empty for an equality comparison", () => {
        expect(isGameFilterEmpty(parseUserInput("year:1989"))).toBe(false);
    });

    it("is empty for an empty query", () => {
        expect(isGameFilterEmpty(parseUserInput(""))).toBe(true);
    });

    it("is not empty for a quoted phrase", () => {
        expect(isGameFilterEmpty(parseUserInput("\"Monkey Island\""))).toBe(
            false
        );
    });
});

describe("parseUserInput - quoted values", () => {
    it("captures a multi-word exact value under its key", () => {
        const filter = parseUserInput(
            "pub=\"Virgin Interactive Entertainment, Inc.\""
        );
        expect(filter.exactWhitelist.publisher).toEqual([
            "Virgin Interactive Entertainment, Inc.",
        ]);
    });

    it("captures a bare quoted phrase as a single generic term", () => {
        const filter = parseUserInput("\"Monkey Island\"");
        expect(filter.whitelist.generic).toEqual(["Monkey Island"]);
    });

    it("retains terms that follow a quoted value", () => {
        const filter = parseUserInput("pub=\"Some Name\" #adventure");
        expect(filter.exactWhitelist.publisher).toEqual(["Some Name"]);
        expect(filter.whitelist.genre).toEqual(["adventure"]);
    });

    it("does not keep the closing quote of a single-token quoted value", () => {
        const filter = parseUserInput("pub=\"Virgin\"");
        expect(filter.exactWhitelist.publisher).toEqual(["Virgin"]);
    });

    it("lets the key character decide exactness for quoted values", () => {
        const filter = parseUserInput("pub:\"Virgin Interactive\"");
        expect(filter.whitelist.publisher).toEqual(["Virgin Interactive"]);
        expect(filter.exactWhitelist.publisher).toEqual([]);
    });

    it("keeps a value whose quote is still open, as while typing", () => {
        const filter = parseUserInput("pub=\"Virgin Inter");
        expect(filter.exactWhitelist.publisher).toEqual(["Virgin Inter"]);
        expect(isGameFilterEmpty(filter)).toBe(false);
    });

    it("still treats an empty quoted value as an exact empty match", () => {
        const filter = parseUserInput("pub=\"\"");
        expect(filter.exactWhitelist.publisher).toEqual([""]);
    });
});

describe("parseUserInput - play mode", () => {
    it("maps playmode: to the playMode field", () => {
        expect(parseUserInput("playmode:single").whitelist.playMode).toEqual([
            "single",
        ]);
    });

    it("accepts play_mode as an alias", () => {
        expect(parseUserInput("play_mode:coop").whitelist.playMode).toEqual([
            "coop",
        ]);
    });
});

describe("parseUserInput - comma separated alternatives", () => {
    it("turns a comma list into an OR subfilter", () => {
        const filter = parseUserInput("pub:sierra,lucasarts");
        expect(filter.subfilters).toHaveLength(1);
        expect(filter.subfilters[0].matchAny).toBe(true);
        expect(filter.subfilters[0].whitelist.publisher).toEqual([
            "sierra",
            "lucasarts",
        ]);
    });

    it("keeps a single value out of a subfilter", () => {
        const filter = parseUserInput("pub:sierra");
        expect(filter.subfilters).toHaveLength(0);
        expect(filter.whitelist.publisher).toEqual(["sierra"]);
    });

    it("ORs genre shortcuts too", () => {
        const filter = parseUserInput("#action,adventure");
        expect(filter.subfilters[0].whitelist.genre).toEqual([
            "action",
            "adventure",
        ]);
    });

    it("ANDs a comma list against other terms", () => {
        const filter = parseUserInput("year>1990 pub:sierra,lucasarts");
        expect(filter.matchAny).toBe(false);
        expect(filter.greaterThan.releaseYear).toBe("1990");
        expect(filter.subfilters[0].matchAny).toBe(true);
    });

    it("does not split commas inside a quoted value", () => {
        const filter = parseUserInput("pub=\"Virgin Interactive, Inc.\"");
        expect(filter.subfilters).toHaveLength(0);
        expect(filter.exactWhitelist.publisher).toEqual([
            "Virgin Interactive, Inc.",
        ]);
    });

    it("negates the whole alternatives group", () => {
        const filter = parseUserInput("-pub:sierra,lucasarts");
        expect(filter.subfilters[0].matchAny).toBe(true);
        expect(filter.subfilters[0].blacklist.publisher).toEqual([
            "sierra",
            "lucasarts",
        ]);
    });
});

describe("parseUserInput - unrecognized keys", () => {
    it("warns about a key it does not understand", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        try {
            parseUserInput("devs:sierra");
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining("devs")
            );
        } finally {
            warn.mockRestore();
        }
    });

    it("does not warn about a plain text term", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        try {
            parseUserInput("monkey");
            expect(warn).not.toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });
});
