import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ipcRenderer } from "electron";
import { BackIn } from "@shared/back/types";
import { UpdaterIPC } from "@shared/interfaces";
import { IAppConfigData } from "@shared/config/interfaces";
import {
    RESTART_REQUIRED_CONFIG_KEYS,
    RESTART_REQUIRED_CONFIG_LABELS,
} from "@shared/config/util";
import { setTheme } from "@shared/Theme";
import { Theme } from "@shared/ThemeFile";
import * as React from "react";
import { useSelector } from "react-redux";
import { isExodosValidCheck } from "../../Util";
import { ConfigExodosPathInput } from "../ConfigExodosPathInput";
import { RootState } from "../../redux/store";
import { getStartupConfig } from "../../startupConfig";

type OwnProps = {
    themeList: Theme[];
};

export type ConfigPageProps = OwnProps;

type ConfigPageState = IAppConfigData & {
    isExodosPathValid?: boolean;
    advancedExpanded: boolean;
    saveError?: string;
};

export class ConfigPage extends React.Component<ConfigPageProps, ConfigPageState> {
    constructor(props: ConfigPageProps) {
        super(props);
        const configData = window.External.config.data;
        this.state = {
            ...configData,
            nativePlatforms: [...configData.nativePlatforms],
            isExodosPathValid: undefined,
            advancedExpanded: false,
        };
    }

    /** Labels of the options that were changed since startup and only take effect after a restart. */
    private pendingRestartLabels(): string[] {
        const startup = getStartupConfig();
        return RESTART_REQUIRED_CONFIG_KEYS.filter(
            (key) => !ConfigPage.isConfigValueEqual(startup[key], this.state[key])
        ).map((key) => RESTART_REQUIRED_CONFIG_LABELS[key] as string);
    }

    /**
     * Persist a single option straight away. The control moves optimistically and is put back to
     * the last persisted value if the write fails, so the UI never claims a change that isn't on disk.
     */
    private commit<K extends keyof IAppConfigData>(
        key: K,
        value: IAppConfigData[K],
        apply?: (value: IAppConfigData[K]) => void
    ): void {
        const previous = window.External.config.data[key];
        apply?.(value);
        this.setState({ [key]: value, saveError: undefined } as unknown as ConfigPageState);

        window.External.back
        .request(BackIn.UPDATE_CONFIG, { [key]: value })
        .then(() => {
            window.External.config.data = {
                ...window.External.config.data,
                [key]: value,
            };
            if (key === "enableOnlineUpdate" || key === "updateChannel") {
                ipcRenderer.send(UpdaterIPC.UPDATE_CONFIG, {
                    enabled: window.External.config.data.enableOnlineUpdate,
                    channel: window.External.config.data.updateChannel,
                });
            }
        })
        .catch((err) => {
            apply?.(previous);
            this.setState({
                [key]: previous,
                saveError: err?.message ?? String(err),
            } as unknown as ConfigPageState);
        });
    }

    render() {
        const restartLabels = this.pendingRestartLabels();

        return (
            <div className="config-page simple-scroll">
                <div className="config-page__content">
                    <h1 className="config-page__title">Config</h1>
                    <p className="config-page__subtitle">
                        Changes are saved as soon as you make them.
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
                                    onChange={(e) => this.commit("useSortTitleForOrdering", e.target.checked)}
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
                                    onChange={(e) => this.commit("currentTheme", e.target.value, setTheme)}
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
                                    onChange={(e) => this.commit("useCustomTitlebar", e.target.checked)}
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
                                            onChange={(e) => this.commit("updateChannel", e.target.value as "stable" | "beta")}
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
                                            onChange={(e) => this.commit("enableOnlineUpdate", e.target.checked)}
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
                    <section className="cfg-section cfg-section--hidden">
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
                                                onInputCommit={this.onExodosPathCommit}
                                                isValid={this.state.isExodosPathValid}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {this.state.saveError && (
                        <div className="cfg-note cfg-note--warning">
                            Failed to save configuration: {this.state.saveError}
                        </div>
                    )}
                    {restartLabels.length > 0 && <RestartNotice labels={restartLabels} />}
                </div>
            </div>
        );
    }

    onExodosLocationModeChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
        this.commit("useEmbeddedExodosPath", event.target.value === "embedded");
    };

    onExodosPathChange = async (filePath: string): Promise<void> => {
        this.setState({ exodosPath: filePath });
        const isValid = await isExodosValidCheck(filePath);
        this.setState({ isExodosPathValid: isValid });
    };

    onExodosPathCommit = async (filePath: string): Promise<void> => {
        const isValid = await isExodosValidCheck(filePath);
        this.setState({ isExodosPathValid: isValid });
        if (isValid) {
            this.commit("exodosPath", filePath);
        }
    };

    isUpdateSupported = (): boolean => {
        return window.External.runtime.onlineUpdateSupported;
    };

    onCheckForUpdatesClick = (): void => {
        ipcRenderer.send(UpdaterIPC.CHECK_FOR_UPDATES);
    };

    // Assumes IAppConfigData fields are primitives or string[]. Add deep-equal handling if nested objects are ever introduced.
    private static isConfigValueEqual(a: unknown, b: unknown): boolean {
        if (Array.isArray(a) && Array.isArray(b)) {
            return a.length === b.length && a.every((v, i) => v === b[i]);
        }
        return a === b;
    }
}

function RestartNotice({ labels }: { labels: string[] }) {
    const plural = labels.length > 1;
    return (
        <div className="cfg-note cfg-note--warning cfg-restart-note">
            <div className="cfg-restart-note__text">
                <span>
                    Restart the app so the following {plural ? "changes take" : "change takes"} effect:
                </span>
                <ul className="cfg-restart-note__list">
                    {labels.map((label) => (
                        <li key={label}>
                            <b>{label}</b>
                        </li>
                    ))}
                </ul>
            </div>
            <button
                className="simple-button cfg-restart-note__button"
                onClick={() => window.External.restart()}
            >
                Restart Now
            </button>
        </div>
    );
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
