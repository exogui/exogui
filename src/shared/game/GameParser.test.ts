import { GameParser, generateGameOrderTitle } from "./GameParser";

jest.mock("fs", () => ({
    existsSync: jest.fn().mockReturnValue(false),
}));

jest.mock("uuid", () => ({ v4: () => "mock-uuid" }));

const minimalRawGame = {
    ID: "test-id",
    Title: "Test Game",
    RootFolder: "eXo/eXoDOS/TestGame",
};

describe("generateGameOrderTitle", () => {
    it("lowercases the title", () => {
        expect(generateGameOrderTitle("Hello World")).toBe("hello world");
    });
});

describe("GameParser.parseRawGame - orderTitle", () => {
    it("uses lowercased title when SortTitle is absent", () => {
        const game = GameParser.parseRawGame(minimalRawGame, "MS-DOS", "/exo");
        expect(game.orderTitle).toBe("test game");
    });

    it("uses SortTitle when present", () => {
        const game = GameParser.parseRawGame(
            { ...minimalRawGame, SortTitle: "King's Quest 1" },
            "MS-DOS",
            "/exo"
        );
        expect(game.orderTitle).toBe("king's quest 1");
    });

    it("falls back to title when SortTitle is empty string", () => {
        const game = GameParser.parseRawGame(
            { ...minimalRawGame, SortTitle: "" },
            "MS-DOS",
            "/exo"
        );
        expect(game.orderTitle).toBe("test game");
    });

    it("SortTitle takes precedence over The-conversion applied to title", () => {
        const game = GameParser.parseRawGame(
            { ...minimalRawGame, Title: "The Dig", SortTitle: "Dig, The" },
            "MS-DOS",
            "/exo"
        );
        expect(game.orderTitle).toBe("dig, the");
    });

    it("applies The-conversion to title when SortTitle absent", () => {
        const game = GameParser.parseRawGame(
            { ...minimalRawGame, Title: "The Dig" },
            "MS-DOS",
            "/exo"
        );
        expect(game.orderTitle).toBe("dig, the");
    });

    it("ignores SortTitle when useSortTitle is false", () => {
        const game = GameParser.parseRawGame(
            { ...minimalRawGame, SortTitle: "King's Quest 1" },
            "MS-DOS",
            "/exo",
            false
        );
        expect(game.orderTitle).toBe("test game");
    });

    it("useSortTitle defaults to true", () => {
        const game = GameParser.parseRawGame(
            { ...minimalRawGame, SortTitle: "King's Quest 1" },
            "MS-DOS",
            "/exo"
        );
        expect(game.orderTitle).toBe("king's quest 1");
    });
});

describe("GameParser.parseRawGame - leading-zero titles", () => {
    // fast-xml-parser with leadingZeros:true converts "007" to the number 7,
    // which then becomes the string "7" — causing image lookups to fail because
    // image files are named "007-XX.jpg". leadingZeros:false keeps "007" as-is.
    it("preserves leading zeros in title string", () => {
        const game = GameParser.parseRawGame(
            { ...minimalRawGame, Title: "007" },
            "ScummVM",
            "/exo"
        );
        expect(game.title).toBe("007");
        expect(game.orderTitle).toBe("007");
    });

    it("title parsed as number (leadingZeros:true regression) loses leading zeros", () => {
        const game = GameParser.parseRawGame(
            { ...minimalRawGame, Title: 7 as any },
            "ScummVM",
            "/exo"
        );
        expect(game.title).toBe("7");
    });
});
