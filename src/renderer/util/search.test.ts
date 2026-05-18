import { isBooleanFilterEmpty, parseAdvancedFilter } from "./search";

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
