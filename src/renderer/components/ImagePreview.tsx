import { BackIn } from "@shared/back/types";
import { getFileServerURL } from "@shared/Util";
import * as React from "react";
import { BoxViewer3D } from "./BoxViewer3D";
import { BareFloatingContainer } from "./FloatingContainer";
import {
    FormattedGameMedia,
    FormattedGameMediaType,
} from "./GameImageCarousel";

export type MediaPreviewProps = {
    /** Media to display. */
    media: FormattedGameMedia;
    /** Called when the user attempts to cancel/close media preview. */
    onCancel?: () => void;
};

export function MediaPreview(props: MediaPreviewProps) {
    const [scaleUp, setScaleUp] = React.useState(false);

    const onClickImage = (event: React.MouseEvent<any>) => {
        setScaleUp(!scaleUp);
        event.preventDefault();
        event.stopPropagation();
        return false;
    };

    React.useEffect(() => {
        if (props.media.type === FormattedGameMediaType.VIDEO) {
            window.External.back.send(BackIn.STOP_MUSIC);
        }
    }, [props.media.type]);

    const { onCancel } = props;
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && onCancel) {
                onCancel();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onCancel]);

    const renderedMedia = () => {
        switch (props.media.type) {
            case FormattedGameMediaType.IMAGE: {
                return (
                    <img
                        className={
                            "image-preview__image" +
                            (scaleUp
                                ? " image-preview__image--fill"
                                : " image-preview__image--fit")
                        }
                        src={`${getFileServerURL()}/${props.media.path}`}
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
                        src={`${getFileServerURL()}/${props.media.path}`}
                    />
                );
            }
            case FormattedGameMediaType.BOX_3D: {
                if (props.media.interactive && props.media.backPath) {
                    return (
                        <div style={{ width: "100%", height: "100%" }}>
                            <BoxViewer3D
                                frontImageUrl={`${getFileServerURL()}/${props.media.path}`}
                                backImageUrl={`${getFileServerURL()}/${props.media.backPath}`}
                                spinePath={props.media.spinePath ? `${getFileServerURL()}/${props.media.spinePath}` : undefined}
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
                        src={`${getFileServerURL()}/${props.media.path}`}
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
                    {props.media.category}
                </div>
            </div>
        </BareFloatingContainer>
    );
}
