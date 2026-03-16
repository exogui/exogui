import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ipcRenderer } from "electron";
import { BackIn } from "@shared/back/types";
import { UpdaterIPC } from "@shared/interfaces";
import { IAppConfigData } from "@shared/config/interfaces";
import { memoizeOne } from "@shared/memoize";
import { setTheme } from "@shared/Theme";
import { Theme } from "@shared/ThemeFile";
import { updatePreferencesData } from "@shared/preferences/util";
import * as React from "react";
import { useSelector } from "react-redux";
import { isExodosValidCheck } from "../../Util";
import { Dropdown } from "../Dropdown";
import { ConfigExodosPathInput } from "../ConfigExodosPathInput";
import { RootState } from "../../redux/store";

type OwnProps = {
    platforms: string[];
    themeList: Theme[];
};

export type ConfigPageProps = OwnProps;

type ConfigPageState = IAppConfigData & {
    isExodosPathValid?: boolean;
    networkExpanded: boolean;
    enableBoxViewer: boolean;
};

export class ConfigPage extends React.Component<ConfigPageProps, ConfigPageState> {
    constructor(props: ConfigPageProps) {
        super(props);
        const configData = window.External.config.data;
        this.state = {
            ...configData,
            nativePlatforms: [...configData.nativePlatforms],
            isExodosPathValid: undefined,
            networkExpanded: false,
            enableBoxViewer: window.External.preferences.data.enableBoxViewer,
        };
    }

    render() {
        const platformOptions = this.itemizePlatformOptionsMemo(
            this.props.platforms,
            this.state.nativePlatforms,
        );

        return (
            <div className="config-page simple-scroll">
                <div className="config-page__content">
                    <h1 className="config-page__title">Config</h1>
                    <p className="config-page__subtitle">
                        You must press &apos;Save &amp; Restart&apos; for some changes to take effect.
                    </p>

                    {/* eXoDOS */}
                    <section className="cfg-section">
                        <h2 className="cfg-section__header">eXoDOS</h2>
                        <div className="cfg-row">
                            <div className="cfg-row__label">
                                <span className="cfg-row__name">eXoDOS Location</span>
                                <span className="cfg-row__desc">How to locate the eXoDOS folder.</span>
                            </div>
                            <div className="cfg-row__control">
                                <select
                                    value={this.state.useEmbeddedExodosPath ? "embedded" : "custom"}
                                    onChange={this.onExodosLocationModeChange}
                                    className="simple-selector"
                                >
                                    <option value="embedded">Auto (embedded)</option>
                                    <option value="custom">Custom path</option>
                                </select>
                            </div>
                        </div>
                        {!this.state.useEmbeddedExodosPath && (
                            <div className="cfg-row cfg-row--filepath">
                                <div className="cfg-row__label">
                                    <span className="cfg-row__name">eXoDOS Path</span>
                                    <span className="cfg-row__desc">Path to the eXoDOS folder (can be relative).</span>
                                </div>
                                <div className="cfg-row__control cfg-row__control--wide">
                                    <ConfigExodosPathInput
                                        input={this.state.exodosPath}
                                        buttonText="Browse"
                                        onInputChange={this.onExodosPathChange}
                                        isValid={this.state.isExodosPathValid}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="cfg-row">
                            <div className="cfg-row__label">
                                <span className="cfg-row__name">Native Platforms</span>
                                <span className="cfg-row__desc">Use native versions of these platforms. If not available, Wine is used.</span>
                            </div>
                            <div className="cfg-row__control">
                                <Dropdown text="Platforms">
                                    {platformOptions.map((item) => (
                                        <label key={item.value} className="log-page__dropdown-item">
                                            <div className="simple-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    onChange={() => this.onNativeCheckboxChange(item.value)}
                                                    className="simple-center__vertical-inner"
                                                />
                                            </div>
                                            <div className="simple-center">
                                                <p className="simple-center__vertical-inner log-page__dropdown-item-text">
                                                    {item.value}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </Dropdown>
                            </div>
                        </div>
                    </section>

                    {/* Visuals */}
                    <section className="cfg-section">
                        <h2 className="cfg-section__header">Visuals</h2>
                        <div className="cfg-row">
                            <div className="cfg-row__label">
                                <span className="cfg-row__name">Use Custom Title Bar</span>
                                <span className="cfg-row__desc">Use a custom title bar at the top of this window.</span>
                            </div>
                            <div className="cfg-row__control">
                                <input
                                    type="checkbox"
                                    checked={this.state.useCustomTitlebar}
                                    onChange={(e) => this.onUseCustomTitlebarChange(e.target.checked)}
                                />
                            </div>
                        </div>
                        <div className="cfg-row">
                            <div className="cfg-row__label">
                                <span className="cfg-row__name">Theme</span>
                                <span className="cfg-row__desc">Select the visual theme for the application.</span>
                            </div>
                            <div className="cfg-row__control">
                                <select
                                    value={this.state.currentTheme || ""}
                                    onChange={(e) => this.applyTheme(e.target.value)}
                                    className="simple-selector"
                                >
                                    {this.props.themeList.map((theme) => (
                                        <option key={theme.entryPath} value={theme.entryPath}>
                                            {theme.meta.name || theme.entryPath}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Updates */}
                    <section className="cfg-section">
                        <h2 className="cfg-section__header">Updates</h2>
                        {this.isUpdateSupported() ? (
                            <>
                                <UpdateVersionRow onCheckNow={this.onCheckForUpdatesClick} />
                                <div className="cfg-row">
                                    <div className="cfg-row__label">
                                        <span className="cfg-row__name">Auto-check on Startup</span>
                                        <span className="cfg-row__desc">Automatically check for updates on startup (Linux AppImage only).</span>
                                    </div>
                                    <div className="cfg-row__control">
                                        <input
                                            type="checkbox"
                                            checked={this.state.enableOnlineUpdate}
                                            onChange={(e) => this.onEnableOnlineUpdateChange(e.target.checked)}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="cfg-note cfg-note--warning">
                                Online updates are not supported on your system. Updates are only available for Linux AppImage builds.
                            </div>
                        )}
                    </section>

                    {/* Network (collapsible) */}
                    <section className="cfg-section">
                        <button
                            className={`cfg-section__toggle${this.state.networkExpanded ? "" : " cfg-section__toggle--collapsed"}`}
                            onClick={() => this.setState({ networkExpanded: !this.state.networkExpanded })}
                        >
                            <span>Network</span>
                            <span>{this.state.networkExpanded ? "▲" : "▼"}</span>
                        </button>
                        {this.state.networkExpanded && (
                            <>
                                <div className="cfg-row">
                                    <div className="cfg-row__label">
                                        <span className="cfg-row__name">Backend Port Min</span>
                                        <span className="cfg-row__desc">Lower limit of the port range for the backend WebSocket server.</span>
                                    </div>
                                    <div className="cfg-row__control">
                                        <input type="number" className="cfg-number-input" value={this.state.backPortMin} onChange={this.onBackPortMinChange} min={1024} max={65535} />
                                    </div>
                                </div>
                                <div className="cfg-row">
                                    <div className="cfg-row__label">
                                        <span className="cfg-row__name">Backend Port Max</span>
                                        <span className="cfg-row__desc">Upper limit of the port range for the backend WebSocket server.</span>
                                    </div>
                                    <div className="cfg-row__control">
                                        <input type="number" className="cfg-number-input" value={this.state.backPortMax} onChange={this.onBackPortMaxChange} min={1024} max={65535} />
                                    </div>
                                </div>
                                <div className="cfg-row">
                                    <div className="cfg-row__label">
                                        <span className="cfg-row__name">Images Port Min</span>
                                        <span className="cfg-row__desc">Lower limit of the port range for the file server.</span>
                                    </div>
                                    <div className="cfg-row__control">
                                        <input type="number" className="cfg-number-input" value={this.state.imagesPortMin} onChange={this.onImagesPortMinChange} min={1024} max={65535} />
                                    </div>
                                </div>
                                <div className="cfg-row">
                                    <div className="cfg-row__label">
                                        <span className="cfg-row__name">Images Port Max</span>
                                        <span className="cfg-row__desc">Upper limit of the port range for the file server.</span>
                                    </div>
                                    <div className="cfg-row__control">
                                        <input type="number" className="cfg-number-input" value={this.state.imagesPortMax} onChange={this.onImagesPortMaxChange} min={1024} max={65535} />
                                    </div>
                                </div>
                                <div className="cfg-row">
                                    <div className="cfg-row__label">
                                        <span className="cfg-row__name">VLC Port</span>
                                        <span className="cfg-row__desc">Port number for VLC media player HTTP interface.</span>
                                    </div>
                                    <div className="cfg-row__control">
                                        <input type="number" className="cfg-number-input" value={this.state.vlcPort} onChange={this.onVlcPortChange} min={1024} max={65535} />
                                    </div>
                                </div>
                            </>
                        )}
                    </section>

                    {/* Experimental */}
                    <section className="cfg-section">
                        <h2 className="cfg-section__header">Experimental Features</h2>
                        <div className="cfg-note cfg-note--warning">
                            Experimental features are works in progress and may not behave as expected. Use them at your own risk.
                        </div>
                        <div className="cfg-row">
                            <div className="cfg-row__label">
                                <span className="cfg-row__name">3D Box Viewer</span>
                                <span className="cfg-row__desc">
                                    Shows an interactive 3D box in the media carousel when both front and back cover scans are available.
                                    The quality of the 3D render depends entirely on the source scans — misaligned borders, color fringing, or missing side faces are expected and are not bugs.
                                    Many games in the collection have scans of varying quality, so results will differ from title to title.
                                </span>
                            </div>
                            <div className="cfg-row__control">
                                <input
                                    type="checkbox"
                                    checked={this.state.enableBoxViewer}
                                    onChange={(e) => this.onEnableBoxViewerChange(e.target.checked)}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Footer */}
                    <div className="cfg-footer">
                        <button className="simple-button cfg-save-btn" onClick={this.onSaveAndRestartClick}>
                            Save and Restart
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    itemizePlatformOptionsMemo = memoizeOne(
        (platforms: string[], nativePlatforms: string[]) =>
            platforms.map((platform) => ({
                value: platform,
                checked: nativePlatforms.includes(platform),
            })),
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

    onExodosPathChange = async (filePath: string): Promise<void> => {
        this.setState({ exodosPath: filePath });
        const isValid = await isExodosValidCheck(filePath);
        this.setState({ isExodosPathValid: isValid });
    };

    onUseCustomTitlebarChange = (isChecked: boolean): void => {
        this.setState({ useCustomTitlebar: isChecked });
    };

    onEnableOnlineUpdateChange = (isChecked: boolean): void => {
        this.setState({ enableOnlineUpdate: isChecked });
    };

    onEnableBoxViewerChange = (isChecked: boolean): void => {
        this.setState({ enableBoxViewer: isChecked });
        updatePreferencesData({ enableBoxViewer: isChecked });
    };

    onBackPortMinChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) this.setState({ backPortMin: v });
    };

    onBackPortMaxChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) this.setState({ backPortMax: v });
    };

    onImagesPortMinChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) this.setState({ imagesPortMin: v });
    };

    onImagesPortMaxChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) this.setState({ imagesPortMax: v });
    };

    onVlcPortChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) this.setState({ vlcPort: v });
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

    onSaveAndRestartClick = (): void => {
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

function UpdateVersionRow({ onCheckNow }: { onCheckNow: () => void }) {
    const status = useSelector((state: RootState) => state.updateDialogState.status);
    const version = window.External.version;

    return (
        <div className="cfg-row">
            <div className="cfg-row__label">
                <span className="cfg-row__name">Version</span>
            </div>
            <div className="cfg-row__control">
                <span className="cfg-version-text">v{version}</span>
                {status === "hidden" && (
                    <button className="simple-button" onClick={onCheckNow}>Check Now</button>
                )}
                {status === "checking" && (
                    <span className="cfg-update-status cfg-update-status--checking">
                        <FontAwesomeIcon icon={faArrowsRotate} className="header__update-spin" />
                        Checking...
                    </span>
                )}
                {status === "available" && (
                    <span className="cfg-update-status cfg-update-status--available">
                        Update available
                    </span>
                )}
                {status === "downloading" && (
                    <span className="cfg-update-status cfg-update-status--checking">
                        Downloading...
                    </span>
                )}
                {status === "downloaded" && (
                    <span className="cfg-update-status cfg-update-status--downloaded">
                        Ready to install
                    </span>
                )}
                {status === "network-error" && (
                    <span className="cfg-update-status cfg-update-status--error">
                        ⚠ Check failed
                    </span>
                )}
                {status === "error" && (
                    <span className="cfg-update-status cfg-update-status--error">
                        ⚠ Error
                    </span>
                )}
            </div>
        </div>
    );
}
