import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ipcRenderer } from "electron";
import { BackIn } from "@shared/back/types";
import { UpdaterIPC } from "@shared/interfaces";
import { IAppConfigData } from "@shared/config/interfaces";
import { RESTART_REQUIRED_CONFIG_KEYS } from "@shared/config/util";
import { setTheme } from "@shared/Theme";
import { Theme } from "@shared/ThemeFile";
import * as React from "react";
import { useSelector } from "react-redux";
import { isExodosValidCheck } from "../../Util";
import { ConfigExodosPathInput } from "../ConfigExodosPathInput";
import { RootState } from "../../redux/store";

type OwnProps = {
    themeList: Theme[];
};

export type ConfigPageProps = OwnProps;

type ConfigPageState = IAppConfigData & {
    isExodosPathValid?: boolean;
    advancedExpanded: boolean;
    saveError?: string;
};

/** Snapshot of restart-required config values at the time ConfigPage first mounted in this session.
 *  Used to decide whether the running app diverges from its disk/startup state. */
let appStartConfigSnapshot: IAppConfigData | null = null;

export class ConfigPage extends React.Component<ConfigPageProps, ConfigPageState> {
    constructor(props: ConfigPageProps) {
        super(props);
        const configData = window.External.config.data;
        if (!appStartConfigSnapshot) {
            appStartConfigSnapshot = {
                ...configData,
                nativePlatforms: [...configData.nativePlatforms],
            };
        }
        this.state = {
            ...configData,
            nativePlatforms: [...configData.nativePlatforms],
            isExodosPathValid: undefined,
            advancedExpanded: false,
        };
    }

    private static computeRestartRequired(current: IAppConfigData): boolean {
        if (!appStartConfigSnapshot) return false;
        return RESTART_REQUIRED_CONFIG_KEYS.some(
            (key) => !ConfigPage.isConfigValueEqual(appStartConfigSnapshot![key], current[key])
        );
    }

    private isDirty(): boolean {
        const saved = window.External.config.data;
        return (Object.keys(saved) as (keyof IAppConfigData)[]).some(
            (key) => !ConfigPage.isConfigValueEqual(this.state[key], saved[key])
        );
    }

    render() {
        const dirty = this.isDirty();
        const restartRequired = ConfigPage.computeRestartRequired(this.state);

        return (
            <div className="config-page simple-scroll">
                <div className="config-page__content">
                    <h1 className="config-page__title">Config</h1>
                    <p className="config-page__subtitle">
                        Press &apos;Save&apos; to apply changes.
                    </p>

                    {/* Games */}
                    <section className="cfg-section">
                        <h2 className="cfg-section__header">Games</h2>
                        <div className="cfg-row">
                            <div className="cfg-row__label">
                                <span className="cfg-row__name">Sort Games by Sort Title</span>
                                <span className="cfg-row__desc">
                                    When enabled, games are sorted using the &lt;SortTitle&gt; tag from the game data instead of the display title.
                                </span>
                            </div>
                            <div className="cfg-row__control">
                                <input
                                    type="checkbox"
                                    checked={this.state.useSortTitleForOrdering}
                                    onChange={(e) => this.onUseSortTitleForOrderingChange(e.target.checked)}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Visuals */}
                    <section className="cfg-section">
                        <h2 className="cfg-section__header">Visuals</h2>
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
                        <div className="cfg-row">
                            <div className="cfg-row__label">
                                <span className="cfg-row__name">Use Custom Title Bar</span>
                                <span className="cfg-row__desc">
                                    Draw the title bar with the launcher&apos;s own theme instead of the one your desktop
                                    provides. The window is created without a native frame, so the title, the drag area
                                    and the minimise, maximise and close buttons all come from exogui. This applies on
                                    Windows, macOS and Linux &mdash; on macOS it also removes the native traffic-light
                                    buttons, leaving only the launcher&apos;s own.
                                </span>
                            </div>
                            <div className="cfg-row__control">
                                <input
                                    type="checkbox"
                                    checked={this.state.useCustomTitlebar}
                                    onChange={(e) => this.onUseCustomTitlebarChange(e.target.checked)}
                                />
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
                                        <span className="cfg-row__name">Update Channel</span>
                                        <span className="cfg-row__desc">Stable receives tested releases. Beta receives pre-releases with newer features.</span>
                                    </div>
                                    <div className="cfg-row__control">
                                        <select
                                            value={this.state.updateChannel}
                                            onChange={(e) => this.onUpdateChannelChange(e.target.value as "stable" | "beta")}
                                            className="simple-selector"
                                        >
                                            <option value="stable">Stable</option>
                                            <option value="beta">Beta</option>
                                        </select>
                                    </div>
                                </div>
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

                    {/* Experimental */}
                    <section className="cfg-section">
                        <h2 className="cfg-section__header">Experimental Features</h2>
                        <div className="cfg-note">
                            No experimental features at the moment. New ones may appear here in future releases.
                        </div>
                    </section>

                    {/* Advanced (collapsible) */}
                    <section className="cfg-section">
                        <button
                            className={`cfg-section__toggle${this.state.advancedExpanded ? "" : " cfg-section__toggle--collapsed"}`}
                            onClick={() => this.setState({ advancedExpanded: !this.state.advancedExpanded })}
                        >
                            <span>Advanced</span>
                            <span>{this.state.advancedExpanded ? "▲" : "▼"}</span>
                        </button>
                        {this.state.advancedExpanded && (
                            <>
                                <div className="cfg-note cfg-note--warning">
                                    Only change these if you know what you are doing. A wrong value here can stop the
                                    launcher from finding your games or leave the window without usable controls.
                                </div>
                                <div className="cfg-row">
                                    <div className="cfg-row__label">
                                        <span className="cfg-row__name">Retro eXo Projects Location</span>
                                        <span className="cfg-row__desc">How to locate the Retro eXo Projects folder.</span>
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
                                            <span className="cfg-row__name">Retro eXo Projects Path</span>
                                            <span className="cfg-row__desc">Path to the Retro eXo Projects folder (can be relative).</span>
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

                    {/* Footer */}
                    {this.state.saveError && (
                        <div className="cfg-note cfg-note--warning">
                            Failed to save configuration: {this.state.saveError}
                        </div>
                    )}
                    {restartRequired && (
                        <div className="cfg-note cfg-note--warning">
                            Some changes require an application restart to take effect.
                        </div>
                    )}
                    <div className="cfg-footer">
                        <button
                            className="simple-button cfg-save-btn"
                            onClick={() => window.External.restart()}
                            disabled={dirty || !restartRequired}
                            style={{ visibility: restartRequired ? "visible" : "hidden" }}
                            title={restartRequired && dirty ? "Save your pending changes first." : undefined}
                        >
                            Restart Now
                        </button>
                        <button className="simple-button cfg-save-btn" onClick={this.onSaveClick}>
                            Save
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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

    onUpdateChannelChange = (channel: "stable" | "beta"): void => {
        this.setState({ updateChannel: channel });
    };

    onUseSortTitleForOrderingChange = (isChecked: boolean): void => {
        this.setState({ useSortTitleForOrdering: isChecked });
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

    onSaveClick = (): void => {
        // `currentTheme` is intentionally omitted — `applyTheme` persists it inline on selection.
        const configData: Omit<IAppConfigData, "currentTheme"> = {
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
            showDeveloperTab: this.state.showDeveloperTab,
            vlcPort: this.state.vlcPort,
            enableOnlineUpdate: this.state.enableOnlineUpdate,
            updateChannel: this.state.updateChannel,
            useEmbeddedExodosPath: this.state.useEmbeddedExodosPath,
            useSortTitleForOrdering: this.state.useSortTitleForOrdering,
        };

        window.External.back
        .request(BackIn.UPDATE_CONFIG, configData)
        .then(() => {
            window.External.config.data = {
                ...window.External.config.data,
                ...configData,
                nativePlatforms: [...configData.nativePlatforms],
            };
            ipcRenderer.send(UpdaterIPC.UPDATE_CONFIG, {
                enabled: configData.enableOnlineUpdate,
                channel: configData.updateChannel,
            });
            this.setState({ saveError: undefined });
        })
        .catch((err) => {
            this.setState({ saveError: err?.message ?? String(err) });
        });
    };

    // Assumes IAppConfigData fields are primitives or string[]. Add deep-equal handling if nested objects are ever introduced.
    private static isConfigValueEqual(a: unknown, b: unknown): boolean {
        if (Array.isArray(a) && Array.isArray(b)) {
            return a.length === b.length && a.every((v, i) => v === b[i]);
        }
        return a === b;
    }
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
