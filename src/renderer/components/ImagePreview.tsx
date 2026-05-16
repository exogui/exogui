import { useGamepadNavigation } from "@renderer/hooks/useGamepadNavigation";
import { stopMusic } from "@renderer/redux/searchSlice";
import { getFileServerURL } from "@shared/Util";
import * as React from "react";
import { useDispatch } from "react-redux";
import { BoxViewer3D } from "./BoxViewer3D";
import { BareFloatingContainer } from "./FloatingContainer";
import {
    FormattedGameMedia,
    FormattedGameMediaType,
} from "./GameImageCarousel";

export type MediaPreviewProps = {
    /** List of media to navigate through. */
    mediaList: FormattedGameMedia[];
    /** Index in `mediaList` of the initially displayed media. */
    initialIndex: number;
    /** Called when the user attempts to cancel/close media preview. */
    onCancel?: () => void;
};

export function MediaPreview(props: MediaPreviewProps) {
    const [scaleUp, setScaleUp] = React.useState(false);
    const [index, setIndex] = React.useState(props.initialIndex);
    const dispatch = useDispatch();

    const media = props.mediaList[index] ?? props.mediaList[0];

    const goPrev = React.useCallback(() => {
        setScaleUp(false);
        setIndex((i) => (i - 1 + props.mediaList.length) % props.mediaList.length);
    }, [props.mediaList.length]);

    const goNext = React.useCallback(() => {
        setScaleUp(false);
        setIndex((i) => (i + 1) % props.mediaList.length);
    }, [props.mediaList.length]);

    const onClickImage = (event: React.MouseEvent<any>) => {
        setScaleUp(!scaleUp);
        event.preventDefault();
        event.stopPropagation();
        return false;
    };

    React.useEffect(() => {
        if (media.type === FormattedGameMediaType.VIDEO) {
            dispatch(stopMusic());
        }
    }, [media.type, dispatch]);

    const { onCancel } = props;
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && onCancel) {
                onCancel();
            } else if (e.key === "ArrowLeft") {
                goPrev();
            } else if (e.key === "ArrowRight") {
                goNext();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onCancel, goPrev, goNext]);

    useGamepadNavigation({
        onNavigate: (direction) => {
            if (direction === "left") {
                goPrev();
            } else if (direction === "right") {
                goNext();
            }
        },
    });

    const renderedMedia = () => {
        switch (media.type) {
            case FormattedGameMediaType.IMAGE: {
                return (
                    <img
                        className={
                            "image-preview__image" +
                            (scaleUp
                                ? " image-preview__image--fill"
                                : " image-preview__image--fit")
                        }
                        src={`${getFileServerURL()}/${media.path}`}
                        onClick={onClickImage}
                    />
                );
            }
            case FormattedGameMediaType.VIDEO: {
                return (
                    <video
                        controls
                        autoPlay
                        className={
                            "image-preview__image" +
                            (scaleUp
                                ? " image-preview__image--fill"
                                : " image-preview__image--fit")
                        }
                        src={`${getFileServerURL()}/${media.path}`}
                    />
                );
            }
            case FormattedGameMediaType.BOX_3D: {
                if (media.interactive && media.backPath) {
                    return (
                        <div style={{ width: "100%", height: "100%" }}>
                            <BoxViewer3D
                                frontImageUrl={`${getFileServerURL()}/${media.path}`}
                                backImageUrl={`${getFileServerURL()}/${media.backPath}`}
                                spinePath={media.spinePath ? `${getFileServerURL()}/${media.spinePath}` : undefined}
                                isFullscreen={true}
                                interactive={true}
                            />
                        </div>
                    );
                }
                return (
                    <img
                        className={
                            "image-preview__image" +
                            (scaleUp
                                ? " image-preview__image--fill"
                                : " image-preview__image--fit")
                        }
                        src={`${getFileServerURL()}/${media.path}`}
                        onClick={onClickImage}
                    />
                );
            }
        }
    };

    const onClickBackground = (event: React.MouseEvent<HTMLDivElement>) => {
        if (props.onCancel) {
            props.onCancel();
        }
    };

    return (
        <BareFloatingContainer>
            {props.onCancel && (
                <button
                    className="image-preview-close"
                    onClick={props.onCancel}
                >
                    ✕
                </button>
            )}
            {props.mediaList.length > 1 && (
                <>
                    <button
                        className="image-preview-nav image-preview-nav--prev"
                        title="Previous"
                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    >
                        ‹
                    </button>
                    <button
                        className="image-preview-nav image-preview-nav--next"
                        title="Next"
                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                    >
                        ›
                    </button>
                </>
            )}
            <div
                className="image-preview-container"
                style={{ overflowY: scaleUp ? "auto" : "unset" }}
                onClick={onClickBackground}
            >
                <div style={{ height: scaleUp ? "auto" : "97%" }}>
                    <div
                        className={
                            "image-preview" +
                            (scaleUp
                                ? " image-preview--fill"
                                : " image-preview--fit")
                        }
                    >
                        {renderedMedia()}
                    </div>
                </div>
                <div className="image-preview-label">
                    {media.category}
                </div>
            </div>
        </BareFloatingContainer>
    );
}
