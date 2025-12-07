import { englishTranslation } from "@renderer/lang/en";
import { BackIn } from "@shared/back/types";
import { IAppConfigData } from "@shared/config/interfaces";
import { memoizeOne } from "@shared/memoize";
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
import { ConfigBoxSelectInput } from "../ConfigBoxSelectInput";
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
                            {/* Exodos Path */}
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
                            <ConfigBoxSelectInput
                                title={strings.theme}
                                description={strings.themeDesc}
                                text={
                                    this.getThemeName(
                                        this.state.currentTheme || "",
                                    ) || ""
                                }
                                placeholder={strings.noTheme}
                                editable={true}
                                items={[
                                    ...this.props.themeList.map(
                                        formatThemeItemName,
                                    ),
                                    "No Theme",
                                ]}
                                onChange={this.onCurrentThemeChange}
                                onItemSelect={this.onCurrentThemeItemSelect}
                            />
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

                    {/* -- Advanced -- */}
                    <div className="setting">
                        <p className="setting__title">
                            {strings.advancedHeader}
                        </p>
                        <div className="setting__body">
                            {/* Show Developer Tab */}
                            <ConfigBoxCheckbox
                                title={strings.showDeveloperTab}
                                description={strings.showDeveloperTabDesc}
                                checked={this.state.showDeveloperTab}
                                onToggle={this.onShowDeveloperTab}
                            />
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

    onShowDeveloperTab = (isChecked: boolean): void => {
        this.setState({ showDeveloperTab: isChecked });
    };

    onCurrentThemeChange = (value: string): void => {
        const selectedTheme = this.props.themeList.find(
            (t) => t.entryPath === value,
        );
        if (selectedTheme) {
            this.setState({ currentTheme: selectedTheme.entryPath });
        }
    };

    onCurrentThemeItemSelect = (_: string, index: number): void => {
        // Note: Suggestions with index 0 to "length - 1" are filenames of themes.
        //       Directly after that comes the "No Theme" suggestion.
        let theme: string | undefined;
        if (index < this.props.themeList.length) {
            // (Select a Theme)
            theme = this.props.themeList[index].entryPath;
        } else {
            theme = undefined;
        } // (Deselect the current theme)
        this.setState({ currentTheme: theme });
    };

    getThemeName(entryPath: string): string | undefined {
        const theme = this.props.themeList.find(
            (t) => t.entryPath === entryPath,
        );
        if (theme) {
            return theme.meta.name || theme.entryPath;
        }
        return undefined;
    }

    /** When the "Save & Restart" button is clicked. */
    onSaveAndRestartClick = () => {
        const configData: IAppConfigData = {
            exodosPath: this.state.exodosPath,
            imageFolderPath: this.state.imageFolderPath,
            logoFolderPath: this.state.logoFolderPath,
            playlistFolderPath: this.state.playlistFolderPath,
            jsonFolderPath: this.state.jsonFolderPath,
            platformFolderPath: this.state.platformFolderPath,
            themeFolderPath: this.state.themeFolderPath,
            useCustomTitlebar: this.state.useCustomTitlebar,
            nativePlatforms: this.state.nativePlatforms,
            backPortMin: this.state.backPortMin,
            backPortMax: this.state.backPortMax,
            imagesPortMin: this.state.imagesPortMin,
            imagesPortMax: this.state.imagesPortMax,
            currentTheme: this.state.currentTheme,
            showDeveloperTab: this.state.showDeveloperTab,
            vlcPort: this.state.vlcPort,
        };

        window.External.back
            .request(BackIn.UPDATE_CONFIG, configData)
            .then(() => {
                window.External.restart();
            });
    };
}

/** Format a theme item into a displayable name for the themes drop-down. */
function formatThemeItemName(item: Theme): string {
    return `${item.meta.name} (${item.entryPath})`;
}
