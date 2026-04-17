import { IGameInfo } from "@shared/game/interfaces";
import { binarySearchGame, linearSearchGame } from "../../util/quickSearch";

const g = (orderTitle: string, id = orderTitle): IGameInfo =>
    ({
        id,
        orderTitle,
    } as IGameInfo);

// Sorted alphabetically by orderTitle (as searchMiddleware produces for title-ascending order)
const sortedGames: IGameInfo[] = [
    g("aladdin"),
    g("doom"),
    g("prince of persia"),
    g("supaplex"),
    g("super mario bros"),
    g("super noah's ark 3d"),
    g("ultima iv"),
    g("wolfenstein 3d"),
];

// Same games in a non-alphabetical order (simulating e.g. year or developer sort)
const unsortedGames: IGameInfo[] = [
    g("wolfenstein 3d"),
    g("super noah's ark 3d"),
    g("doom"),
    g("supaplex"),
    g("aladdin"),
    g("super mario bros"),
    g("prince of persia"),
    g("ultima iv"),
];

describe("binarySearchGame", () => {
    test("finds exact title match", () => {
        expect(binarySearchGame(sortedGames, "doom")?.orderTitle).toBe("doom");
    });

    test("finds first game with matching prefix", () => {
        expect(binarySearchGame(sortedGames, "sup")?.orderTitle).toBe("supaplex");
    });

    test("distinguishes supaplex from super titles", () => {
        expect(binarySearchGame(sortedGames, "supa")?.orderTitle).toBe("supaplex");
        expect(binarySearchGame(sortedGames, "supe")?.orderTitle).toBe("super mario bros");
    });

    test("finds first alphabetically when multiple games share a prefix", () => {
        expect(binarySearchGame(sortedGames, "super")?.orderTitle).toBe("super mario bros");
    });

    test("returns first game when query matches beginning of list", () => {
        expect(binarySearchGame(sortedGames, "a")?.orderTitle).toBe("aladdin");
    });

    test("returns last game when query matches last entry", () => {
        expect(binarySearchGame(sortedGames, "wolf")?.orderTitle).toBe("wolfenstein 3d");
    });

    test("returns nearest game when no prefix match exists", () => {
        // "zzz" is past everything — no result
        expect(binarySearchGame(sortedGames, "zzz")).toBeUndefined();
    });

    test("returns undefined for empty list", () => {
        expect(binarySearchGame([], "doom")).toBeUndefined();
    });

    test("query is case-insensitive (orderTitle is already lowercase)", () => {
        expect(binarySearchGame(sortedGames, "doom")?.orderTitle).toBe("doom");
    });
});

describe("linearSearchGame", () => {
    test("finds exact title match regardless of display order", () => {
        expect(linearSearchGame(unsortedGames, "doom")?.orderTitle).toBe("doom");
    });

    test("finds supaplex even though super titles appear earlier in display order", () => {
        expect(linearSearchGame(unsortedGames, "supa")?.orderTitle).toBe("supaplex");
    });

    test("returns alphabetically first match among all prefix matches", () => {
        // Both "super mario bros" and "super noah's ark 3d" start with "super";
        // "super mario bros" < "super noah's ark 3d" alphabetically
        expect(linearSearchGame(unsortedGames, "super")?.orderTitle).toBe("super mario bros");
    });

    test("finds single-character prefix — alphabetically first match", () => {
        expect(linearSearchGame(unsortedGames, "s")?.orderTitle).toBe("supaplex");
    });

    test("returns undefined when no game matches prefix", () => {
        expect(linearSearchGame(unsortedGames, "xyz")).toBeUndefined();
    });

    test("returns undefined for empty list", () => {
        expect(linearSearchGame([], "doom")).toBeUndefined();
    });

    test("handles multi-word prefix", () => {
        expect(linearSearchGame(unsortedGames, "prince of")?.orderTitle).toBe("prince of persia");
    });
});
