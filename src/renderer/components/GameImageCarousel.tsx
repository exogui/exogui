import { fixSlashes, getFileServerURL } from "@shared/Util";
import { GameMedia } from "@shared/game/interfaces";
import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { PreferencesContext } from "../context/PreferencesContext";
import { BoxViewer3D } from "./BoxViewer3D";
import { OpenIcon } from "./OpenIcon";

export type GameImageCarouselProps = {
    media: GameMedia;
    platform: string;
    imgKey: string; // Ensures previous images are always replaced when the selected game changes
    onPreviewMedia: (media: FormattedGameMedia) => void;
};

const IMAGE_COUNT = 4;

export function GameImageCarousel(props: GameImageCarouselProps) {
    const [selectedMediaIdx, setSelectedMediaIdx] = useState(0);
    const [wheelPosition, setWheelPosition] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(0);
    const preferences = useContext(PreferencesContext);

    // When the image changes, reset the selected elements
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when media changes
        setWheelPosition(0);

        setSelectedMediaIdx(0);
    }, [props.media]);

    const sortedMedia = prepareGameMedias(props.media, props.platform, preferences.enableBoxViewer).sort(sortByMediaCategory);

    // Hover functions to trigger the label to show
    const handleMouseEnter = (index: number) => {
        setHoveredIndex(index);
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
    };

    // Wheel arrow functions
    const wheelMoveLeft = () => {
        if (wheelPosition > 0) {
            setWheelPosition(wheelPosition - 1);
        }
    };

    const wheelMoveRight = () => {
        if (wheelPosition < sortedMedia.length - IMAGE_COUNT) {
            setWheelPosition(wheelPosition + 1);
        }
    };

    const imagePreviews = sortedMedia
    .slice(
        Math.min(wheelPosition, sortedMedia.length - 1),
        Math.min(wheelPosition + IMAGE_COUNT, sortedMedia.length)
    )
    .map((media, idx) => {
        const selected = wheelPosition + idx === selectedMediaIdx;

        let innerElem = undefined;
        switch (media.type) {
            case FormattedGameMediaType.IMAGE:
                innerElem = (
                    <img
                        key={props.imgKey}
                        className="fill-image"
                        src={`${getFileServerURL()}/${media.path}`}
                    />
                );
                break;
            case FormattedGameMediaType.VIDEO:
                innerElem = (
                    <>
                        <div className="game-image-carousel-wheel-preview-overlay">
                            <OpenIcon
                                className="game-image-carousel-wheel-preview-overlay--icon"
                                icon="play-circle"
                            />
                        </div>
                        <video
                            key={props.imgKey}
                            className="fill-image"
                            muted
                            src={`${getFileServerURL()}/${media.path
                            }#t=0.1`}
                        ></video>
                    </>
                );
                break;
            case FormattedGameMediaType.BOX_3D:
                innerElem = (
                    <BoxViewer3D
                        key={props.imgKey}
                        frontImageUrl={`${getFileServerURL()}/${media.path}`}
                        backImageUrl={media.backPath ? `${getFileServerURL()}/${media.backPath}` : undefined}
                        spinePath={media.spinePath ? `${getFileServerURL()}/${media.spinePath}` : undefined}
                        interactive={false}
                        thumbMode={true}
                    />
                );
                break;
        }

        return (
            <div
                key={`${props.imgKey}-${idx}`}
                style={{
                    width: `${(1 / IMAGE_COUNT) * (100 - IMAGE_COUNT * 2)
                    }%`,
                    marginLeft: "1%",
                    marginRight: "1%",
                }}
                className={`game-image-carousel-wheel-preview ${selected &&
                        "game-image-carousel-wheel-preview--selected"
                }`}
                onMouseEnter={() => handleMouseEnter(idx)}
                onMouseLeave={handleMouseLeave}
                onClick={() => setSelectedMediaIdx(idx + wheelPosition)}
            >
                {innerElem}
            </div>
        );
    });

    if (
        sortedMedia.length === 0 ||
        wheelPosition > sortedMedia.length - 1 ||
        selectedMediaIdx > sortedMedia.length - 1
    ) {
        return <></>; // Either no images, or the game just changed and state needs reset, let render happen at next state change instead
    }

    const selectedMedia = sortedMedia[selectedMediaIdx];

    const renderSelected = () => {
        switch (selectedMedia.type) {
            case FormattedGameMediaType.IMAGE:
                return (
                    <img
                        key={props.imgKey}
                        className="fill-image cursor"
                        src={`${getFileServerURL()}/${selectedMedia.path}`}
                        onClick={() => props.onPreviewMedia(selectedMedia)}
                    />
                );
            case FormattedGameMediaType.VIDEO:
                return (
                    <video
                        key={props.imgKey}
                        className="fill-image cursor"
                        autoPlay
                        loop
                        muted
                        src={`${getFileServerURL()}/${selectedMedia.path}`}
                        onClick={() => props.onPreviewMedia(selectedMedia)}
                    />
                );
            case FormattedGameMediaType.BOX_3D:
                return (
                    <div
                        key={props.imgKey}
                        className={selectedMedia.interactive ? "cursor" : undefined}
                        style={{ width: "100%", height: "100%" }}
                        onClick={selectedMedia.interactive ? () => props.onPreviewMedia(selectedMedia) : undefined}
                    >
                        <BoxViewer3D
                            frontImageUrl={`${getFileServerURL()}/${selectedMedia.path}`}
                            backImageUrl={selectedMedia.backPath ? `${getFileServerURL()}/${selectedMedia.backPath}` : undefined}
                            spinePath={selectedMedia.spinePath ? `${getFileServerURL()}/${selectedMedia.spinePath}` : undefined}
                            interactive={false}
                        />
                    </div>
                );
        }
    };

    return (
        <div className="game-image-carousel">
            <div className="game-image-carousel-selected">
                {renderSelected()}
            </div>
            {sortedMedia.length > 1 && (
                <>
                    <div className="game-image-carousel-wheel">
                        {wheelPosition > 0 && (
                            <div
                                className="game-image-carousel-wheel-arrow"
                                onClick={wheelMoveLeft}
                            >
                                <OpenIcon icon="arrow-left" />
                            </div>
                        )}
                        <div className="game-image-carousel-wheel-previews">
                            {imagePreviews}
                        </div>
                        {wheelPosition < sortedMedia.length - IMAGE_COUNT && (
                            <div
                                className="game-image-carousel-wheel-arrow"
                                onClick={wheelMoveRight}
                            >
                                <OpenIcon icon="arrow-right" />
                            </div>
                        )}
                    </div>
                    <div className="game-image-carousel-label">
                        {hoveredIndex === null
                            ? selectedMedia.category
                            : sortedMedia[wheelPosition + hoveredIndex]
                            .category}
                    </div>
                </>
            )}
        </div>
    );
}

export enum FormattedGameMediaType {
    IMAGE,
    VIDEO,
    BOX_3D,
}

export type GameMediaCategory =
    | "30 Second Demo"
    | "Screenshot - Gameplay"
    | "Screenshot - Game Title"
    | "Box Viewer"
    | "Box - 3D"
    | "Box - Front"
    | "Box - Back"
    | "Box - Spine"
    | "Clear Logo"
    | "Disc"
    | "Banner"
    | "Fanart - Background";

export type FormattedGameMedia = {
    category: GameMediaCategory;
    type: FormattedGameMediaType;
    path: string;
    backPath?: string;
    spinePath?: string;
    interactive?: boolean;
};

function prepareGameMedias(
    media: GameMedia,
    platform: string,
    enableBoxViewer: boolean
): FormattedGameMedia[] {
    const list: FormattedGameMedia[] = [];

    if (media.video) {
        list.push({
            category: "30 Second Demo",
            type: FormattedGameMediaType.VIDEO,
            path: fixSlashes(media.video),
        });
    }

    if (enableBoxViewer) {
        const frontFiles = media.images["Box - Front"];
        const backFiles = media.images["Box - Back"];
        const spineFiles = media.images["Box - Spine"];

        const hasFront = frontFiles && frontFiles.length > 0;
        const hasBack = backFiles && backFiles.length > 0;
        const hasSpine = spineFiles && spineFiles.length > 0;

        if (hasFront && hasBack) {
            list.push({
                category: "Box Viewer",
                type: FormattedGameMediaType.BOX_3D,
                path: fixSlashes(`Images/${platform}/${frontFiles[0]}`),
                backPath: fixSlashes(`Images/${platform}/${backFiles[0]}`),
                spinePath: hasSpine
                    ? fixSlashes(`Images/${platform}/${spineFiles[0]}`)
                    : undefined,
                interactive: true,
            });
        }
    }

    for (const category of Object.keys(media.images)) {
        for (const filename of media.images[category]) {
            list.push({
                category: category as GameMediaCategory,
                type: FormattedGameMediaType.IMAGE,
                path: fixSlashes(`Images/${platform}/${filename}`),
            });
        }
    }
    return list;
}

function mediaSortKey(m: FormattedGameMedia): number {
    if (m.type === FormattedGameMediaType.VIDEO) { return 0; }
    if (m.type === FormattedGameMediaType.BOX_3D) { return 2; }
    const categoryOrder: Partial<Record<GameMediaCategory, number>> = {
        "Screenshot - Gameplay": 1,
        "Screenshot - Game Title": 3,
        "Clear Logo": 4,
        "Disc": 5,
        "Banner": 6,
        "Fanart - Background": 7,
        "Box - 3D": 8,
        "Box - Front": 9,
        "Box - Back": 10,
        "Box - Spine": 11,
        "Box Viewer": 12,
    };
    return categoryOrder[m.category] ?? 12;
}

const sortByMediaCategory = (a: FormattedGameMedia, b: FormattedGameMedia) => {
    return mediaSortKey(a) - mediaSortKey(b);
};
