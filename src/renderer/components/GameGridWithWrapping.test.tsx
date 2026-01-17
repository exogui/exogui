import { IGameInfo } from "@shared/game/interfaces";
import * as React from "react";

// Mock GameGrid before importing GameGridWithWrapping to avoid react-virtualized ES module issues
jest.mock("./GameGrid", () => ({
    GameGrid: () => <div data-testid="mock-game-grid" />,
}));

import { GameGridWithWrapping } from "./GameGridWithWrapping";

const createMockGame = (id: string, title: string): IGameInfo => ({
    id,
    title,
    convertedTitle: title,
    alternateTitles: "",
    platform: "MS-DOS",
    series: "",
    developer: "",
    publisher: "",
    dateAdded: "",
    source: "",
    playMode: "",
    status: "",
    notes: "",
    genre: "",
    applicationPath: "",
    rootFolder: "",
    launchCommand: "",
    releaseYear: "1990",
    version: "",
    originalDescription: "",
    language: "",
    favorite: false,
    recommended: false,
    region: "",
    rating: "",
    maxPlayers: 1,
    library: "",
    orderTitle: title,
    placeholder: false,
    manualPath: "",
    musicPath: "",
    thumbnailPath: "",
    configurationPath: "",
    installed: false,
    media: {
        images: {},
        video: "",
    },
});

describe("GameGridWithWrapping", () => {
    const mockGames: IGameInfo[] = [
        createMockGame("game1", "Game 1"),
        createMockGame("game2", "Game 2"),
        createMockGame("game3", "Game 3"),
        createMockGame("game4", "Game 4"),
        createMockGame("game5", "Game 5"),
        createMockGame("game6", "Game 6"),
    ];

    const defaultProps = {
        games: mockGames,
        gamesTotal: mockGames.length,
        selectedGame: mockGames[0],
        cellWidth: 200,
        cellHeight: 300,
        onGameSelect: jest.fn(),
        onGameLaunch: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("enableWrapping prop", () => {
        test("wrapping works when enableWrapping is true (default)", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                selectedGame: mockGames[2], // Last column (col 2) in first row
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowRight",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(onGameSelect).toHaveBeenCalledWith(mockGames[3]); // First column of next row
        });

        test("wrapping works when enableWrapping is explicitly true", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                enableWrapping: true,
                selectedGame: mockGames[2],
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowRight",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(onGameSelect).toHaveBeenCalledWith(mockGames[3]);
        });

        test("does not attach onKeyDown when enableWrapping is false", () => {
            const component = new GameGridWithWrapping({
                ...defaultProps,
                enableWrapping: false,
            });

            const { onKeyDown } = component.render().props as any;
            expect(onKeyDown).toBeUndefined();
        });
    });

    describe("Wrapping from end column to start column (right arrow)", () => {
        test("wraps from last column to first column of next row", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                selectedGame: mockGames[2], // Index 2, last column (col 2) of row 0
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowRight",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(onGameSelect).toHaveBeenCalledWith(mockGames[3]); // Index 3, first column (col 0) of row 1
        });

        test("wraps correctly with multiple rows", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                selectedGame: mockGames[5], // Index 5, last column (col 2) of row 1
                onGameSelect,
            });
            component.cachedColumns = 3;

            // This is already the last row, should not wrap
            const event = {
                key: "ArrowRight",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(onGameSelect).not.toHaveBeenCalled();
        });
    });

    describe("Wrapping from start column to end column (left arrow)", () => {
        test("wraps from first column to last column of previous row", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                selectedGame: mockGames[3], // Index 3, first column (col 0) of row 1
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowLeft",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
            expect(onGameSelect).toHaveBeenCalledWith(mockGames[2]); // Index 2, last column (col 2) of row 0
        });

        test("wraps to correct column in partial last row", () => {
            const onGameSelect = jest.fn();
            const partialGames = mockGames.slice(0, 5); // 5 games: row 0 has 3, row 1 has 2
            const component = new GameGridWithWrapping({
                ...defaultProps,
                games: partialGames,
                gamesTotal: 5,
                selectedGame: partialGames[3], // First column of row 1
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowLeft",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(onGameSelect).toHaveBeenCalledWith(partialGames[2]); // Last column of row 0
        });
    });

    describe("Edge cases", () => {
        test("does not wrap at first game (first row, first column)", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                selectedGame: mockGames[0], // First game
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowLeft",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(onGameSelect).not.toHaveBeenCalled();
        });

        test("does not wrap at last game (last row, last column)", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                selectedGame: mockGames[5], // Last game
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowRight",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(onGameSelect).not.toHaveBeenCalled();
        });

        test("handles single row grid (no wrapping possible)", () => {
            const onGameSelect = jest.fn();
            const singleRowGames = mockGames.slice(0, 3);
            const component = new GameGridWithWrapping({
                ...defaultProps,
                games: singleRowGames,
                gamesTotal: 3,
                selectedGame: singleRowGames[2], // Last column, only row
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowRight",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(onGameSelect).not.toHaveBeenCalled();
        });

        test("handles empty game list", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                games: [],
                gamesTotal: 0,
                selectedGame: undefined,
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowRight",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(onGameSelect).not.toHaveBeenCalled();
        });

        test("handles no selected game", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                selectedGame: undefined,
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "ArrowRight",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(onGameSelect).not.toHaveBeenCalled();
        });

        test("ignores non-arrow keys", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                onGameSelect,
            });
            component.cachedColumns = 3;

            const event = {
                key: "Enter",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(onGameSelect).not.toHaveBeenCalled();
        });

        test("ignores up/down arrows", () => {
            const onGameSelect = jest.fn();
            const component = new GameGridWithWrapping({
                ...defaultProps,
                onGameSelect,
            });
            component.cachedColumns = 3;

            const eventUp = {
                key: "ArrowUp",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            const eventDown = {
                key: "ArrowDown",
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            } as unknown as React.KeyboardEvent;

            component.onKeyDown(eventUp);
            component.onKeyDown(eventDown);

            expect(eventUp.preventDefault).not.toHaveBeenCalled();
            expect(eventDown.preventDefault).not.toHaveBeenCalled();
            expect(onGameSelect).not.toHaveBeenCalled();
        });
    });
});
