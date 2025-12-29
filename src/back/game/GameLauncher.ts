import { OpenExternalFunc } from "@back/types";
import { ShowMessageBoxFunc } from "@shared/back/types";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { ExecMapping } from "@shared/interfaces";
import { Command, createCommand } from "@shared/mappings/CommandMapping";
import { IAppCommandsMappingData } from "@shared/mappings/interfaces";
import {
    fixSlashes,
    getFilename,
    padStart,
    stringifyArray,
} from "@shared/Util";
import { ChildProcess, exec } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";

export type LaunchAddAppOpts = LaunchBaseOpts & {
    addApp: IAdditionalApplicationInfo;
    native: boolean;
};

export type LaunchGameOpts = LaunchBaseOpts & {
    game: IGameInfo;
    addApps?: IAdditionalApplicationInfo[];
    native: boolean;
};

type LaunchBaseOpts = {
    fpPath: string;
    execMappings: ExecMapping[];
    mappings: IAppCommandsMappingData;
    openDialog: ShowMessageBoxFunc;
    openExternal: OpenExternalFunc;
};

// @TODO we probably doesn't need seperate launch functions for add apps, setup, etc.
// Only one function to launch file with mapper for different file types
export namespace GameLauncher {
    const logSource = "Game Launcher";

    /**
     * @deprecated Legacy feature from Flashpoint Launcher
     * Handles special applicationPath values (`:message:`, `:extras:`) that may exist in LaunchBox XML.
     * Not confirmed to be used in eXoDOS collections - kept for compatibility.
     * @returns true if special case was handled, false if should proceed with normal launch
     */
    function handleSpecialApplicationPath(
        applicationPath: string,
        launchCommand: string,
        fpPath: string,
        openDialog: ShowMessageBoxFunc,
        openExternal: OpenExternalFunc
    ): boolean {
        switch (applicationPath) {
            case ":message:": {
                openDialog({
                    type: "info",
                    title: "About This Game",
                    message: launchCommand,
                    buttons: ["Ok"],
                });
                return true;
            }
            case ":extras:": {
                const folderPath = fixSlashes(
                    path.join(fpPath, path.posix.join("Extras", launchCommand))
                );
                openExternal(folderPath, { activate: true })
                .catch((error) => {
                    if (error) {
                        openDialog({
                            type: "error",
                            title: "Failed to Open Extras",
                            message: `${error.toString()}\nPath: ${folderPath}`,
                            buttons: ["Ok"],
                        });
                    }
                });
                return true;
            }
            default:
                return false;
        }
    }

    export function launchCommand(
        appPath: string,
        appArgs: string,
        mappings: IAppCommandsMappingData,
    ): Promise<void> {
        const command = createCommand(appPath, appArgs, mappings);
        const proc = exec(command.command, { cwd: command.cwd });
        logProcessOutput(proc);
        log(logSource, `Launch command (PID: ${proc.pid}) [ path: "${appPath}", arg: "${appArgs}", command: ${command} ]`);
        return new Promise((resolve, reject) => {
            if (proc.killed) {
                resolve();
            } else {
                proc.once("exit", () => {
                    resolve();
                });
                proc.once("error", (error) => {
                    reject(error);
                });
            }
        });
    }

    export async function launchAdditionalApplication(
        opts: LaunchAddAppOpts
    ): Promise<void> {
        const handled = handleSpecialApplicationPath(
            opts.addApp.applicationPath,
            opts.addApp.launchCommand,
            opts.fpPath,
            opts.openDialog,
            opts.openExternal
        );

        if (!handled) {
            const appPath = resolveApplicationPath(
                opts.addApp.applicationPath,
                opts.fpPath,
                opts.execMappings,
                opts.native
            );
            return launchCommand(appPath, opts.addApp.launchCommand, opts.mappings);
        }
    }

    /**
     * Launch a game
     * @param game Game to launch
     */
    export async function launchGame(opts: LaunchGameOpts): Promise<void> {
        if (opts.game.placeholder) {
            return;
        }

        // Run AutoRunBefore additional applications
        if (opts.addApps) {
            const addAppOpts: Omit<LaunchAddAppOpts, "addApp"> = {
                fpPath: opts.fpPath,
                native: opts.native,
                execMappings: opts.execMappings,
                mappings: opts.mappings,
                openDialog: opts.openDialog,
                openExternal: opts.openExternal,
            };
            for (const addApp of opts.addApps) {
                if (addApp.autoRunBefore) {
                    const promise = launchAdditionalApplication({
                        ...addAppOpts,
                        addApp,
                    });
                    if (addApp.waitForExit) {
                        await promise;
                    }
                }
            }
        }

        const gamePath = resolveApplicationPath(
            opts.game.applicationPath,
            opts.fpPath,
            opts.execMappings,
            opts.native
        );

        let command: Command;
        try {
            command = createCommand(gamePath, opts.game.launchCommand, opts.mappings);
        } catch (e) {
            log(logSource, `Launch Game "${opts.game.title}" failed. Error: ${e}`);
            return;
        }

        const proc = exec(command.command, { cwd: command.cwd });
        logProcessOutput(proc);
        log(logSource, `Launch Game "${opts.game.title}" (PID: ${proc.pid}) [\n` +
            `    applicationPath: "${opts.game.applicationPath}",\n` +
            `    launchCommand:   "${opts.game.launchCommand}",\n` +
            `    command:         "${command}" ]`);
    }

    /**
     * Launch game setup/installer
     * @param game Game to launch setup for
     */
    export async function launchGameSetup(opts: LaunchGameOpts): Promise<void> {
        const setupPath = opts.game.applicationPath.replace(
            getFilename(opts.game.applicationPath),
            "install.command"
        );
        const gamePath = resolveApplicationPath(
            setupPath,
            opts.fpPath,
            opts.execMappings,
            opts.native
        );

        const command = createCommand(gamePath, opts.game.launchCommand, opts.mappings);
        const proc = exec(command.command, { cwd: command.cwd });
        logProcessOutput(proc);
        log(logSource, `Launch Game Setup "${opts.game.title}" (PID: ${proc.pid}) [\n` +
            `    applicationPath: "${opts.game.applicationPath}",\n` +
            `    launchCommand:   "${opts.game.launchCommand}",\n` +
            `    command:         "${command}" ]`);
    }

    /**
     * Resolves an application path to an absolute path.
     * Handles .bat -> .command conversion and exec mappings for native ports.
     */
    export function resolveApplicationPath(
        relativePath: string,
        fpPath: string,
        execMappings: ExecMapping[],
        native: boolean
    ): string {
        const platform = process.platform;
        let filePath = relativePath;

        // Bat files won't work on Wine, force a .command file on non-Windows platforms instead.
        if (platform !== "win32" && filePath.endsWith(".bat")) {
            filePath = filePath.substring(0, filePath.length - 4) + ".command";
        }

        // Check exec mappings for native platform executables
        if (platform !== "win32" && native) {
            for (let i = 0; i < execMappings.length; i++) {
                const mapping = execMappings[i];
                if (mapping.win32 === filePath) {
                    switch (platform) {
                        case "linux":
                            filePath = mapping.linux || mapping.win32;
                            break;
                        case "darwin":
                            filePath = mapping.darwin || mapping.win32;
                            break;
                    }
                    break;
                }
            }
        }

        return fixSlashes(path.join(fpPath, filePath));
    }

    function logProcessOutput(proc: ChildProcess): void {
        // Log for debugging purposes
        // (might be a bad idea to fill the console with junk?)
        const logStuff = (event: string, args: any[]): void => {
            log(logSource, `${event} (PID: ${padStart(
                proc.pid ?? -1,
                5
            )}) ${stringifyArray(args, stringifyArrayOpts)}`);
        };
        doStuffs(
            proc,
            [/* 'close', */ "disconnect", "error", "exit", "message"],
            logStuff
        );
        if (proc.stdout) {
            proc.stdout.on("data", (data) => {
                logStuff("stdout", [data.toString("utf8")]);
            });
        }
        if (proc.stderr) {
            proc.stderr.on("data", (data) => {
                logStuff("stderr", [data.toString("utf8")]);
            });
        }
    }
}

const stringifyArrayOpts = {
    trimStrings: true,
};

function doStuffs(
    emitter: EventEmitter,
    events: string[],
    callback: (event: string, args: any[]) => void
): void {
    for (let i = 0; i < events.length; i++) {
        const e: string = events[i];
        emitter.on(e, (...args: any[]) => {
            callback(e, args);
        });
    }
}
