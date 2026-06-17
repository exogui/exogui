import { shell } from "@electron/remote";
import { faFolder, faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { englishTranslation } from "@renderer/lang/en";
import { AdvancedFilter } from "@renderer/redux/searchSlice";
import { loadDynamicAddAppsForGame } from "@renderer/util/addApps";
import { openGameConfigDirectory } from "@renderer/util/games";
import { fixSlashes } from "@shared/Util";
import { LOGOS, SCREENSHOTS } from "@shared/constants";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { GamePlaylistEntry } from "@shared/interfaces";
import { MenuItemConstructorOptions } from "electron";
import { promises as fs } from "fs";
import * as path from "path";
import * as React from "react";
import { getGameImagePath, openContextMenu } from "../Util";
import { WithPreferencesProps } from "../containers/withPreferences";
import { FormattedGameMedia, GameImageCarousel } from "./GameImageCarousel";
import { MediaPreview } from "./ImagePreview";
import { InputField } from "./InputField";
import { RightBrowseSidebarAddApp } from "./RightBrowseSidebarAddApp";

type OwnProps = {
    /** Currently selected game (if any) */
    currentGame?: IGameInfo;
    /** Additional Applications of the currently selected game (if any) */
    currentAddApps?: IAdditionalApplicationInfo[];
    /** Notes of the selected game in the selected playlist (if any) */
    currentPlaylistNotes?: string;
    /** Currently selected game entry (if any) */
    gamePlaylistEntry?: GamePlaylistEntry;
    /** Launch game */
    onGameLaunch: (gameId: string) => void;
    /** Launch game setup */
    onGameLaunchSetup: (gameId: string) => void;
    /** Launch add app */
    onAddAppLaunch: (addApp: IAdditionalApplicationInfo) => void;
    /** Toggle favorite state for the current game */
    onFavoriteToggle: (game: IGameInfo) => void;
    /** Toggle a single metadata field value as an advanced filter in the current view */
    onSearchField: (field: keyof AdvancedFilter, value: string) => void;
    /** Currently active advanced filter (used to highlight selected values) */
    advancedFilter?: AdvancedFilter;
};

export type RightBrowseSidebarProps = OwnProps & WithPreferencesProps;

/** Split a ";"-separated metadata field into unique, trimmed values. */
function splitFieldValues(raw: string): string[] {
    const values: string[] = [];
    for (const part of (raw ?? "").split(";")) {
        const trimmed = part.trim();
        if (trimmed.length > 0 && !values.includes(trimmed)) {
            values.push(trimmed);
        }
    }
    return values;
}

type RightBrowseSidebarState = {
    /** If a preview of the current game's selected media. */
    previewMediaList?: FormattedGameMedia[];
    previewMediaIndex?: number;
    existingAddApps?: IAdditionalApplicationInfo[];
    dynamicAddApps?: IAdditionalApplicationInfo[];
};

/** Sidebar on the right side of BrowsePage. */
export class RightBrowseSidebar extends React.Component<
    RightBrowseSidebarProps,
    RightBrowseSidebarState
> {
    launchCommandRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props: RightBrowseSidebarProps) {
        super(props);
        this.state = {};
    }

    checkAddAppsExistence = async () => {
        const addAppsToCheck = this.props.currentAddApps ?? [];
        const existingAddApps: IAdditionalApplicationInfo[] = [];
        for (const addApp of addAppsToCheck) {
            try {
                const absolutePath = path.join(
                    window.External.config.fullExodosPath,
                    fixSlashes(addApp.applicationPath)
                );
                await fs.access(absolutePath);
                existingAddApps.push(addApp);
            } catch {
                // Do nothing
            }
        }

        this.setState({ existingAddApps });
    };

    getDynamicAddApps = () => {
        if (!this.props.currentGame) {
            this.setState({ dynamicAddApps: [] });
            return;
        }

        const dynamicAddApps = loadDynamicAddAppsForGame(
            this.props.currentGame
        );

        console.debug(
            `Found ${dynamicAddApps.length} for ${this.props.currentGame.title} game.`
        );

        this.setState({ dynamicAddApps });
    };

    renderSearchableRow = (
        label: string,
        placeholder: string,
        field: keyof AdvancedFilter,
        values: string[]
    ): React.ReactNode => {
        const selected = (this.props.advancedFilter?.[field] as string[]) ?? [];
        return (
            <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                <p>{label}: </p>
                {values.length > 0 ? (
                    <p className="input-field browse-right-sidebar__searchable-values">
                        {values.map((value, index) => (
                            <React.Fragment key={value}>
                                {index > 0 ? (
                                    <span className="browse-right-sidebar__searchable-separator">
                                        ;{" "}
                                    </span>
                                ) : null}
                                <span
                                    className={`browse-right-sidebar__searchable${
                                        selected.includes(value)
                                            ? " browse-right-sidebar__searchable--active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        this.props.onSearchField(field, value)
                                    }
                                >
                                    {value}
                                </span>
                            </React.Fragment>
                        ))}
                    </p>
                ) : (
                    <p className="input-field simple-disabled-text">
                        {placeholder}
                    </p>
                )}
            </div>
        );
    };

    componentDidMount(): void {
        this.checkAddAppsExistence();
        this.getDynamicAddApps();
    }

    componentDidUpdate(prevProps: Readonly<RightBrowseSidebarProps>): void {
        if (prevProps.currentAddApps !== this.props.currentAddApps) {
            this.setState({ existingAddApps: [] });
            this.checkAddAppsExistence();
        }
        if (prevProps.currentGame !== this.props.currentGame) {
            this.setState({ dynamicAddApps: [] });
            this.getDynamicAddApps();
        }
    }

    render() {
        const strings = englishTranslation.browse;
        const game: IGameInfo | undefined = this.props.currentGame;
        const addApps = [
            ...(this.state.existingAddApps ?? []),
            ...(this.state.dynamicAddApps ?? []),
        ];
        // HACK: This is a hacky solution to determine if the selected item is a game or a magazine
        if (game) {
            const { currentGame, gamePlaylistEntry, currentPlaylistNotes } =
                this.props;

            const isGame = !!game?.configurationPath;
            const playButtonLabel = isGame
                ? currentGame?.installed
                    ? strings.play
                    : strings.install
                : strings.open;
            const releaseYear = (game.releaseYear ?? "").split("-")[0].trim();
            return (
                <div
                    className={
                        "browse-right-sidebar browse-right-sidebar--edit-disabled"
                    }
                >
                    {/* -- Title & Developer(s) -- */}
                    <div className="browse-right-sidebar__section">
                        <div className="browse-right-sidebar__row">
                            <div className="browse-right-sidebar__title-row">
                                <div className="browse-right-sidebar__title-row__title">
                                    <InputField
                                        text={game.convertedTitle}
                                        placeholder={strings.noTitle}
                                    />
                                </div>
                                <div className="browse-right-sidebar__title-row__buttons">
                                    <input
                                        type="button"
                                        className="simple-button"
                                        value={playButtonLabel}
                                        onClick={() =>
                                            this.props.onGameLaunch(game.id)
                                        }
                                    />
                                    {isGame ? (
                                        <>
                                            <input
                                                type="button"
                                                className="simple-button"
                                                disabled={
                                                    !currentGame?.installed
                                                }
                                                value={strings.setup}
                                                onClick={() =>
                                                    this.props.onGameLaunchSetup(
                                                        game.id
                                                    )
                                                }
                                            />
                                            <i className="simple-button">
                                                <FontAwesomeIcon
                                                    icon={faFolder}
                                                    onClick={() =>
                                                        openGameConfigDirectory(
                                                            game
                                                        )
                                                    }
                                                />
                                            </i>
                                            <i
                                                className={`simple-button browse-right-sidebar__favorite-btn${game.favorite ? " browse-right-sidebar__favorite-btn--active" : ""}`}
                                                title={game.favorite ? "Remove from Favorites" : "Add to Favorites"}
                                                onClick={() => this.props.onFavoriteToggle(game)}
                                            >
                                                <FontAwesomeIcon icon={faHeart} />
                                            </i>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* -- Game Image Carousel -- */}
                    <div className="browse-right-sidebar__section">
                        <GameImageCarousel
                            imgKey={game.id}
                            media={game.media}
                            platform={game.platform}
                            onPreviewMedia={this.onPreviewMedia}
                        />
                    </div>

                    {/* -- Most Fields -- */}
                    <div className="browse-right-sidebar__section">
                        {this.renderSearchableRow(
                            strings.genre,
                            strings.noGenre,
                            "genre",
                            splitFieldValues(game.genre)
                        )}
                        {this.renderSearchableRow(
                            strings.series,
                            strings.noSeries,
                            "series",
                            splitFieldValues(game.series)
                        )}
                        {this.renderSearchableRow(
                            strings.developer,
                            strings.noDeveloper,
                            "developer",
                            splitFieldValues(game.developer)
                        )}
                        {this.renderSearchableRow(
                            strings.publisher,
                            strings.noPublisher,
                            "publisher",
                            splitFieldValues(game.publisher)
                        )}
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.source}: </p>
                            <InputField
                                text={game.source}
                                placeholder={strings.noSource}
                            />
                        </div>
                        <div className="browse-right-sidebar__row browse-right-sidebar__row--one-line">
                            <p>{strings.platform}: </p>
                            <InputField
                                text={game.platform}
                                placeholder={strings.noPlatform}
                            />
                        </div>
                        {this.renderSearchableRow(
                            strings.playMode,
                            strings.noPlayMode,
                            "playMode",
                            splitFieldValues(game.playMode)
                        )}
                        {this.renderSearchableRow(
                            strings.releaseYear,
                            strings.noReleaseDate,
                            "releaseYear",
                            releaseYear ? [releaseYear] : []
                        )}
                    </div>
                    {/* -- Playlist Game Entry Notes -- */}
                    {gamePlaylistEntry ? (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row">
                                <p>{strings.playlistNotes}: </p>
                                <InputField
                                    text={currentPlaylistNotes || ""}
                                    placeholder={strings.noPlaylistNotes}
                                    multiline={true}
                                />
                            </div>
                        </div>
                    ) : undefined}
                    {/* -- Notes -- */}
                    {game.notes ? (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row">
                                <p>{strings.notes}: </p>
                                <InputField
                                    text={game.notes}
                                    placeholder={strings.noNotes}
                                    multiline={true}
                                />
                            </div>
                        </div>
                    ) : undefined}
                    {/* -- Original Description -- */}
                    {game.originalDescription ? (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row">
                                <p>{strings.originalDescription}: </p>
                                <InputField
                                    text={game.originalDescription}
                                    placeholder={strings.noOriginalDescription}
                                    multiline={true}
                                />
                            </div>
                        </div>
                    ) : undefined}
                    {/* -- Additional Applications -- */}
                    {addApps.length > 0 && (
                        <div className="browse-right-sidebar__section">
                            <div className="browse-right-sidebar__row browse-right-sidebar__row--additional-applications-header">
                                <p>{strings.addApps}:</p>
                            </div>
                            {addApps.map((addApp) => (
                                <RightBrowseSidebarAddApp
                                    key={addApp.id}
                                    addApp={addApp}
                                    onLaunch={this.props.onAddAppLaunch.bind(
                                        this
                                    )}
                                />
                            ))}
                        </div>
                    )}
                    {/* -- Media Preview -- */}
                    {this.state.previewMediaList && this.state.previewMediaIndex !== undefined ? (
                        <MediaPreview
                            mediaList={this.state.previewMediaList}
                            initialIndex={this.state.previewMediaIndex}
                            onCancel={this.onPreviewMediaClick}
                        />
                    ) : undefined}
                </div>
            );
        } else {
            return (
                <div className="browse-right-sidebar-empty">
                    <h1>{strings.noGameSelected}</h1>
                    <p>{strings.clickToSelectGame}</p>
                </div>
            );
        }
    }

    onScreenshotContextMenu = (event: React.MouseEvent) => {
        const { currentGame } = this.props;
        const template: MenuItemConstructorOptions[] = [];
        if (currentGame) {
            template.push({
                label: englishTranslation.menu.viewThumbnailInFolder,
                click: () => {
                    shell.showItemInFolder(
                        getGameImagePath(LOGOS, currentGame.id).replace(
                            /\//g,
                            "\\"
                        )
                    );
                },
                enabled: true,
            });
            template.push({
                label: englishTranslation.menu.viewScreenshotInFolder,
                click: () => {
                    shell.showItemInFolder(
                        getGameImagePath(SCREENSHOTS, currentGame.id).replace(
                            /\//g,
                            "\\"
                        )
                    );
                },
                enabled: true,
            });
        }
        if (template.length > 0) {
            event.preventDefault();
            openContextMenu(template);
        }
    };

    onPreviewMedia = (mediaList: FormattedGameMedia[], index: number): void => {
        this.setState({ previewMediaList: mediaList, previewMediaIndex: index });
    };

    onPreviewMediaClick = (): void => {
        this.setState({ previewMediaList: undefined, previewMediaIndex: undefined });
    };
}
