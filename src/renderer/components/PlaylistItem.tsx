import * as React from "react";
import { useCallback, useMemo } from "react";
import { GamePlaylist } from "@shared/interfaces";
import { InputElement, InputField } from "./InputField";
import { englishTranslation } from "@renderer/lang/en";

export type PlaylistItemProps = {
    playlist: GamePlaylist;
    iconFilename?: string;
    selected: boolean;
    playlistIconCache: Record<string, string>;
    onHeadClick: (playlist: GamePlaylist, selected: boolean) => void;
    onSetIcon: () => void;
    onTitleChange: (event: React.ChangeEvent<InputElement>) => void;
    onAuthorChange: (event: React.ChangeEvent<InputElement>) => void;
};

export function PlaylistItem(props: PlaylistItemProps) {
    const {
        playlist,
        selected,
        iconFilename,
        playlistIconCache,
        onHeadClick: onHeadClickProp,
        onSetIcon,
    } = props;
    const strings = englishTranslation.playlist;

    const onHeadClick = useCallback(() => {
        onHeadClickProp(playlist, selected);
    }, [onHeadClickProp, playlist, selected]);

    const onIconClick = useCallback(() => {
        if (selected) {
            onSetIcon();
        }
    }, [onSetIcon, selected]);

    const icon = useMemo(() => {
        return playlistIconCache[
        iconFilename || playlist.filename
        ];
    }, [
        iconFilename,
        playlist.filename,
        playlistIconCache,
    ]);

    let className = "playlist-list-item";
    if (props.selected) {
        className += " playlist-list-item--selected";
    }

    return (
        <div className={className}>
            {/* Drag Overlay */}
            <div className="playlist-list-item__drag-overlay" />
            {/* Head */}
            <div className="playlist-list-item__head" onClick={onHeadClick}>
                {/* Icon */}
                {props.playlist.icon ? (
                    <div className="playlist-list-item__icon">
                        <div
                            className="playlist-list-item__icon-image"
                            style={{ backgroundImage: icon }}
                            onClick={onIconClick}
                        />
                    </div>
                ) : null}
                {/* Title */}
                <div className="playlist-list-item__title simple-center">
                    <InputField
                        text={props.playlist.title}
                        placeholder={strings.noTitle}
                        className="playlist-list-item__text-field"
                        onChange={props.onTitleChange}
                    />
                </div>
                {/* Author */}
                {props.playlist.author ? (
                    <>
                        <div className="playlist-list-item__divider simple-center">
                            <p className="simple-center__inner">{strings.by}</p>
                        </div>
                        <div className="playlist-list-item__author simple-center">
                            <InputField
                                text={props.playlist.author}
                                placeholder={strings.noAuthor}
                                className="playlist-list-item__text-field"
                                onChange={props.onAuthorChange}
                            />
                        </div>
                    </>
                ) : undefined}
            </div>
        </div>
    );
}
