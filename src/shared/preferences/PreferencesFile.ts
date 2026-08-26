import * as fs from "fs";
import { IAppPreferencesData } from "./interfaces";
import { defaultPreferencesData, overwritePreferenceData } from "./util";
import { deepCopy, readJsonFile, writeJsonDataFile } from "../Util";

/** Static class with methods for saving, loading and parsing the Preferences file */
export namespace PreferencesFile {
    /** Encoding used by preferences file. */
    const fileEncoding: BufferEncoding = "utf8";

    /**
     * Attempt to read and parse the preferences file, then return the result.
     * If the file does not exist, create a new one with the default values and return that instead.
     * @param onError Called for each error that occurs while parsing.
     */
    export async function readOrCreateFile(
        filePath: string,
        onError?: (error: string) => void
    ): Promise<IAppPreferencesData> {
        let error: Error | undefined, data: IAppPreferencesData | undefined;
        // Try to get the data from the file
        console.info(`Reading preferences file... (${filePath}) `);
        try {
            data = await readFile(filePath, onError);
        } catch (e) {
            error = e as Error;
            console.error("Failed to read preferences file!", error);
        }
        // If that failed, set data to default and save it to a new file
        if (error || !data) {
            await backupUnreadableFile(filePath);
            data = deepCopy(defaultPreferencesData);
            await saveFile(filePath, data).catch(() =>
                console.log("Failed to save default preferences file!")
            );
        }
        // Return
        return data;
    }

    export function readFile(
        filePath: string,
        onError?: (error: string) => void
    ): Promise<IAppPreferencesData> {
        return new Promise((resolve, reject) => {
            readJsonFile(filePath, fileEncoding)
            .then((json) =>
                resolve(
                    overwritePreferenceData(
                        deepCopy(defaultPreferencesData),
                        json,
                        onError
                    )
                )
            )
            .catch(reject);
        });
    }

    export function saveFile(
        filePath: string,
        data: IAppPreferencesData
    ): Promise<void> {
        return writeJsonDataFile(filePath, data);
    }

    /**
     * Keep a copy of a preferences file we are about to replace with the defaults, so a parse
     * failure does not silently throw the user's settings away.
     */
    async function backupUnreadableFile(filePath: string): Promise<void> {
        const backupPath = `${filePath}.bak`;
        try {
            await fs.promises.copyFile(filePath, backupPath);
            console.log(
                `Kept a copy of the unreadable preferences file at ${backupPath}. Replacing it with the defaults.`
            );
        } catch (error: any) {
            if (error?.code !== "ENOENT") {
                console.log(`Failed to back up the unreadable preferences file! ${error}`);
            }
        }
    }
}
