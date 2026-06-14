jest.mock("./games", () => ({ getGameByTitle: jest.fn() }));
jest.mock("@renderer/redux/store", () => ({ getState: jest.fn(), dispatch: jest.fn() }));
jest.mock("@renderer/redux/gamesSlice", () => ({ updateGame: jest.fn() }));
jest.mock("chokidar", () => ({ watch: jest.fn(() => ({ on: jest.fn() })) }));

import * as fs from "fs";
import { IGameInfo } from "@shared/game/interfaces";
import { loadDynamicAddAppsForGame } from "./addApps";

function makeGame(rootFolder: string): IGameInfo {
    return { id: "1", title: "Premier Manager", rootFolder } as unknown as IGameInfo;
}

const makeDirent = (name: string): fs.Dirent =>
    ({ name, isFile: () => true } as unknown as fs.Dirent);

describe("loadDynamicAddAppsForGame", () => {
    const extrasFiles = [
        "Copy.Protection.Codes.ods",
        "Interactive Code Wheel.HTM",
        "Alternate Launcher.command",
    ];

    beforeEach(() => {
        (window as any).External = {
            config: { fullExodosPath: "/test" },
            commandMappings: {
                commandsMapping: [
                    { command: "", extensions: ["htm", "html"] },
                    { command: "", extensions: ["xls", "xlsx", "ods"] },
                    { command: "", extensions: ["command"] },
                ],
                defaultMapping: { command: "" },
            },
        };

        jest.spyOn(fs, "readdirSync").mockImplementation((_dir: any, opts?: any) => {
            if (opts && opts.withFileTypes) {
                return extrasFiles.map(makeDirent) as any;
            }
            return ["Extras"] as any;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (window as any).External;
    });

    it("includes an extra whose filename contains multiple periods", () => {
        const game = makeGame("eXo\\eXoDOS\\!dos\\PremM");
        const names = loadDynamicAddAppsForGame(game).map((a) => a.name);
        expect(names).toContain("Copy.Protection.Codes");
    });

    it("includes single-extension extras", () => {
        const game = makeGame("eXo\\eXoDOS\\!dos\\PremM");
        const names = loadDynamicAddAppsForGame(game).map((a) => a.name);
        expect(names).toContain("Interactive Code Wheel");
        expect(names).toContain("Alternate Launcher");
    });
});
