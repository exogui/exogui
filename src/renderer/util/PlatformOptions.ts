import { app } from "@electron/remote";
import { getResourcesPath } from "@shared/ResourcePath";
import { readJsonFile } from "@shared/Util";
import * as path from "path";

const platformOptionsFilename = path.join(
    getResourcesPath(app, window.External.isDev),
    "platform_options.json"
);

export interface PlatformOptions {
    name: string;
    watchable: boolean;
}

export const DefaultPlatformOptions = {
    name: "",
    watchable: false,
};

export let platformOptions: PlatformOptions[] | null;

const init = async () => {
    console.log("Loading platform options file...");
    try {
        platformOptions = await readJsonFile(platformOptionsFilename);
    } catch (e) {
        const errorMessage = (e as any)?.message ?? e;
        console.error(
            `Cannot load platform options file. Error: ${errorMessage}`
        );
    }
};
init();
