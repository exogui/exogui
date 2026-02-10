import { englishTranslation } from "@renderer/lang/en";
import { ipcRenderer } from "electron";
import { BackIn } from "@shared/back/types";
import { UpdaterIPC } from "@shared/interfaces";
import { IAppConfigData } from "@shared/config/interfaces";
import { memoizeOne } from "@shared/memoize";
import { setTheme } from "@shared/Theme";
import { Theme } from "@shared/ThemeFile";
import * as React from "react";
import { isExodosValidCheck } from "../../Util";
import { ConfigBox } from "../ConfigBox";
import { ConfigBoxCheckbox } from "../ConfigBoxCheckbox";
import { ConfigBoxNumberInput } from "../ConfigBoxInput";
import {
    ConfigBoxMultiSelect,
    MultiSelectItem,
} from "../ConfigBoxMultiSelect";
import { ConfigExodosPathInput } from "../ConfigExodosPathInput";

type OwnProps = {
    /** List of all platforms */
    platforms: string[];
    /** Filenames of all files in the themes folder. */
    themeList: Theme[];
};

export type ConfigPageProps = OwnProps;

type ConfigPageState = IAppConfigData & {
    /** If the currently entered Exodos path points to a "valid" Exodos folder. */
    isExodosPathValid?: boolean;
};

/**
 * A page displaying all settings from config.json.
 * All changes require you to "Save & Restart" to take effect.
 */
export class ConfigPage extends React.Component<
    ConfigPageProps,
    ConfigPageState
> {
    constructor(props: ConfigPageProps) {
        super(props);
        const configData = window.External.config.data;
        this.state = {
            ...configData,
            nativePlatforms: [...configData.nativePlatforms],
            isExodosPathValid: undefined,
        };
    }

    render() {
        const strings = englishTranslation.config;
        const platformOptions = this.itemizePlatformOptionsMemo(
            this.props.platforms,
            this.state.nativePlatforms,
        );

        return (
            <div className="config-page simple-scroll">
                <div className="config-page__inner">
                    <h1 className="config-page__title">
                        {strings.configHeader}
                    </h1>
                    <p className="config-page__description">
                        {strings.configDesc}
                    </p>

                    {/* -- eXoDOS -- */}
                    <div className="setting">
                        <p className="setting__title">{strings.exodosHeader}</p>
                        <div className="setting__body">
                            {/* eXoDOS Location Mode */}
                            <ConfigBox
                                title={strings.exodosLocationMode}
                                description={strings.exodosLocationModeDesc}
                            >
                                <select
                                    value={this.state.useEmbeddedExodosPath ? "embedded" : "custom"}
                                    onChange={this.onExodosLocationModeChange}
                                    className="simple-input"
                                >
                                    <option value="embedded">{strings.exodosLocationEmbedded}</option>
                                    <option value="custom">{strings.exodosLocationCustom}</option>
                                </select>
                            </ConfigBox>
                            {/* Exodos Path (only in custom mode) */}
                            {!this.state.useEmbeddedExodosPath && (
                                <ConfigBox
                                    title={strings.exodosPath}
                                    description={strings.exodosPathDesc}
                                    contentClassName="setting__row__content--filepath-path"
                                >
                                    <ConfigExodosPathInput
                                        input={this.state.exodosPath}
                                        buttonText={strings.browse}
                                        onInputChange={this.onExodosPathChange}
                                        isValid={this.state.isExodosPathValid}
                                    />
                                </ConfigBox>
                            )}
                            {/* Native Platforms */}
                            <ConfigBoxMultiSelect
                                title={strings.nativePlatforms}
                                description={strings.nativePlatformsDesc}
                                text={strings.platforms}
                                onChange={this.onNativeCheckboxChange}
                                items={platformOptions}
                            />
                        </div>
                    </div>

                    {/* -- Visuals -- */}
                    <div className="setting">
                        <p className="setting__title">
                            {strings.visualsHeader}
                        </p>
                        <div className="setting__body">
                            {/* Custom Title Bar */}
                            <ConfigBoxCheckbox
                                title={strings.useCustomTitleBar}
                                description={strings.useCustomTitleBarDesc}
                                checked={this.state.useCustomTitlebar}
                                onToggle={this.onUseCustomTitlebarChange}
                            />
                            {/* Theme */}
                            <ConfigBox
                                title={strings.theme}
                                description={strings.themeDesc}
                            >
                                <select
                                    value={this.state.currentTheme || ""}
                                    onChange={(e) => this.applyTheme(e.target.value)}
                                    className="simple-input"
                                >
                                    {this.props.themeList.map((theme) => (
                                        <option key={theme.entryPath} value={theme.entryPath}>
                                            {theme.meta.name || theme.entryPath}
                                        </option>
                                    ))}
                                </select>
                            </ConfigBox>
                        </div>
                    </div>

                    {/* -- Network -- */}
                    <div className="setting">
                        <p className="setting__title">{strings.networkHeader}</p>
                        <div className="setting__body">
                            <ConfigBoxNumberInput
                                title={strings.backPortMin}
                                description={strings.backPortMinDesc}
                                value={this.state.backPortMin}
                                onChange={(v) => this.setState({ backPortMin: v })}
                                min={1024}
                                max={65535}
                            />
                            <ConfigBoxNumberInput
                                title={strings.backPortMax}
                                description={strings.backPortMaxDesc}
                                value={this.state.backPortMax}
                                onChange={(v) => this.setState({ backPortMax: v })}
                                min={1024}
                                max={65535}
                            />
                            <ConfigBoxNumberInput
                                title={strings.imagesPortMin}
                                description={strings.imagesPortMinDesc}
                                value={this.state.imagesPortMin}
                                onChange={(v) => this.setState({ imagesPortMin: v })}
                                min={1024}
                                max={65535}
                            />
                            <ConfigBoxNumberInput
                                title={strings.imagesPortMax}
                                description={strings.imagesPortMaxDesc}
                                value={this.state.imagesPortMax}
                                onChange={(v) => this.setState({ imagesPortMax: v })}
                                min={1024}
                                max={65535}
                            />
                            <ConfigBoxNumberInput
                                title={strings.vlcPort}
                                description={strings.vlcPortDesc}
                                value={this.state.vlcPort}
                                onChange={(v) => this.setState({ vlcPort: v })}
                                min={1024}
                                max={65535}
                            />
                        </div>
                    </div>

                    {/* -- Updates -- */}
                    <div className="setting">
                        <p className="setting__title">
                            {strings.updatesHeader}
                        </p>
                        <div className="setting__body">
                            {this.isUpdateSupported() ? (
                                <>
                                    {/* Enable Online Updates */}
                                    <ConfigBoxCheckbox
                                        title={strings.enableOnlineUpdates}
                                        description={strings.enableOnlineUpdatesDesc}
                                        checked={this.state.enableOnlineUpdate}
                                        onToggle={this.onEnableOnlineUpdateChange}
                                    />
                                    {/* Check for Updates */}
                                    <ConfigBox
                                        title={strings.checkForUpdates}
                                        description={strings.checkForUpdatesDesc}
                                    >
                                        <input
                                            type="button"
                                            value={strings.checkNow}
                                            className="simple-button"
                                            onClick={this.onCheckForUpdatesClick}
                                        />
                                    </ConfigBox>
                                </>
                            ) : (
                                <div className="config-page__note config-page__note--warning">
                                    <strong>Note:</strong> {strings.updatesNotSupported}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* -- Save & Restart -- */}
                    <div className="setting">
                        <div className="setting__row">
                            <input
                                type="button"
                                value={strings.saveAndRestart}
                                className="simple-button save-and-restart"
                                onClick={this.onSaveAndRestartClick}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    itemizePlatformOptionsMemo = memoizeOne(
        (
            platforms: string[],
            nativePlatforms: string[],
        ): MultiSelectItem<string>[] => {
            return platforms.map((platform) => {
                return {
                    value: platform,
                    checked: nativePlatforms.includes(platform),
                };
            });
        },
    );

    onNativeCheckboxChange = (platform: string): void => {
        const nativePlatforms = [...this.state.nativePlatforms];
        const index = nativePlatforms.findIndex((item) => item === platform);

        if (index !== -1) {
            nativePlatforms.splice(index, 1);
        } else {
            nativePlatforms.push(platform);
        }
        this.setState({ nativePlatforms });
    };

    onExodosLocationModeChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
        this.setState({ useEmbeddedExodosPath: event.target.value === "embedded" });
    };

    /** When the "Exodos Folder Path" input text is changed. */
    onExodosPathChange = async (filePath: string): Promise<void> => {
        this.setState({ exodosPath: filePath });
        // Check if the file-path points at a valid Exodos folder
        const isValid = await isExodosValidCheck(filePath);
        this.setState({ isExodosPathValid: isValid });
    };

    onUseCustomTitlebarChange = (isChecked: boolean): void => {
        this.setState({ useCustomTitlebar: isChecked });
    };

    onEnableOnlineUpdateChange = (isChecked: boolean): void => {
        this.setState({ enableOnlineUpdate: isChecked });
    };

    isUpdateSupported = (): boolean => {
        return window.External.runtime.onlineUpdateSupported;
    };

    onCheckForUpdatesClick = (): void => {
        ipcRenderer.send(UpdaterIPC.CHECK_FOR_UPDATES);
    };

    applyTheme = (theme: string | undefined): void => {
        this.setState({ currentTheme: theme });
        setTheme(theme);
        window.External.config.data.currentTheme = theme;
        window.External.back.request(BackIn.UPDATE_CONFIG, { currentTheme: theme });
    };

    /** When the "Save & Restart" button is clicked. */
    onSaveAndRestartClick = () => {
        const configData: IAppConfigData = {
            exodosPath: this.state.exodosPath,
            imageFolderPath: this.state.imageFolderPath,
            logoFolderPath: this.state.logoFolderPath,
            playlistFolderPath: this.state.playlistFolderPath,
            jsonFolderPath: this.state.jsonFolderPath,
            platformFolderPath: this.state.platformFolderPath,
            useCustomTitlebar: this.state.useCustomTitlebar,
            nativePlatforms: this.state.nativePlatforms,
            backPortMin: this.state.backPortMin,
            backPortMax: this.state.backPortMax,
            imagesPortMin: this.state.imagesPortMin,
            imagesPortMax: this.state.imagesPortMax,
            currentTheme: this.state.currentTheme,
            vlcPort: this.state.vlcPort,
            enableOnlineUpdate: this.state.enableOnlineUpdate,
            useEmbeddedExodosPath: this.state.useEmbeddedExodosPath,
        };

        window.External.back
        .request(BackIn.UPDATE_CONFIG, configData)
        .then(() => {
            window.External.restart();
        });
    };
}

