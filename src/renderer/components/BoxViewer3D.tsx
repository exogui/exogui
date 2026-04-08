import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export type BoxViewer3DProps = {
    frontImageUrl: string;
    backImageUrl?: string;
    spinePath?: string;
    isFullscreen?: boolean;
    interactive?: boolean;
    thumbMode?: boolean;
    onClick?: () => void;
};

const INITIAL_ROT_Y = -35;
const INITIAL_ROT_X = -5;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;

type BoxDims = { width: number; height: number; depth: number };

function fitBox(naturalWidth: number, naturalHeight: number, maxW: number, maxH: number): BoxDims {
    const ratio = naturalWidth / naturalHeight;
    let width: number;
    let height: number;
    if (ratio > maxW / maxH) {
        width = maxW;
        height = Math.round(maxW / ratio);
    } else {
        height = maxH;
        width = Math.round(maxH * ratio);
    }
    return { width, height, depth: Math.round(width * 0.15) };
}

export function BoxViewer3D(props: BoxViewer3DProps) {
    const { frontImageUrl, backImageUrl, spinePath, isFullscreen, interactive = true, thumbMode = false, onClick } = props;

    const maxW = thumbMode ? 60 : (isFullscreen ? 500 : 170);
    const maxH = thumbMode ? 75 : (isFullscreen ? 580 : 210);
    const [dims, setDims] = useState<BoxDims | null>(null);
    const [rotX, setRotX] = useState(INITIAL_ROT_X);
    const [rotY, setRotY] = useState(INITIAL_ROT_Y);
    const [scale, setScale] = useState(1.0);
    const [isDragging, setIsDragging] = useState(false);
    const [edgeColor, setEdgeColor] = useState("rgb(60, 60, 60)");

    const lastPos = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when image URL changes
        setDims(null);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            setDims(fitBox(img.naturalWidth, img.naturalHeight, maxW, maxH));
            try {
                const canvas = document.createElement("canvas");
                canvas.width = 1;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) { return; }
                ctx.drawImage(img, 0, 0, 1, img.naturalHeight, 0, 0, 1, img.naturalHeight);
                const pixel = ctx.getImageData(0, img.naturalHeight >> 1, 1, 1).data;
                setEdgeColor(`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`);
            } catch (_) {
                // CORS blocked or tainted canvas — keep default color
            }
        };
        img.src = frontImageUrl;
    }, [frontImageUrl, maxW, maxH]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDragging(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !lastPos.current) { return; }
        e.stopPropagation();
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        setRotY((prev) => prev + dx * 0.5);
        setRotX((prev) => Math.max(-80, Math.min(80, prev - dy * 0.5)));
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, [isDragging]);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDragging(false);
        lastPos.current = null;
    }, []);

    const onMouseLeave = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            lastPos.current = null;
        }
    }, [isDragging]);

    const onWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale((prev) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta)));
    }, []);

    const onDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setRotX(INITIAL_ROT_X);
        setRotY(INITIAL_ROT_Y);
        setScale(1.0);
    }, []);

    const onClickHandler = useCallback((e: React.MouseEvent) => {
        if (!isDragging && onClick) {
            onClick();
        }
        e.stopPropagation();
    }, [isDragging, onClick]);

    const interactiveHandlers = interactive
        ? {
            onMouseDown,
            onMouseMove,
            onMouseUp,
            onMouseLeave,
            onWheel,
            onDoubleClick,
            onClick: onClickHandler,
        }
        : {};

    const bgStyle = thumbMode
        ? { width: "100%", height: "100%", overflow: "hidden" as const }
        : { width: "100%", height: "100%", padding: "1.5rem" };

    if (!dims) {
        return <div className="box-viewer-3d__bg" style={bgStyle} />;
    }

    const { width, height, depth } = dims;
    const halfD = depth / 2;
    const perspective = (width + height) * 3;

    // All faces use transform-origin: 0 0 0 (set in CSS).
    // Transforms apply left-to-right, each in the running local space.
    // Derivation (verified algebraically for a W×H×D box):
    //   Front  (W×H): just push forward by D/2
    //   Back   (W×H): translate to right edge, flip 180°, push forward by D/2
    //   Left   (D×H): pull back by D/2, then rotate -90° around Y  → x=0,  z=[-D/2, D/2]
    //   Right  (D×H): translate to right edge, push fwd D/2, rot 90° → x=W,  z=[D/2, -D/2]
    //   Top    (W×D): pull back D/2, rot 90° around X               → y=0,  z=[-D/2, D/2]
    //   Bottom (W×D): translate to bottom, push fwd D/2, rot -90°   → y=H,  z=[D/2, -D/2]

    const faceFront: React.CSSProperties = {
        width,
        height,
        transform: `translateZ(${halfD}px)`,
        backgroundImage: `url('${frontImageUrl}')`,
        backgroundSize: "100% 100%",
    };

    const faceBack: React.CSSProperties = {
        width,
        height,
        transform: `translate3d(${width}px, 0, 0) rotateY(180deg) translateZ(${halfD}px)`,
        backgroundImage: backImageUrl ? `url('${backImageUrl}')` : undefined,
        backgroundSize: "100% 100%",
        backgroundColor: backImageUrl ? undefined : "rgb(40, 40, 40)",
    };

    const faceLeft: React.CSSProperties = {
        width: depth,
        height,
        transform: `translateZ(-${halfD}px) rotateY(-90deg)`,
        backgroundImage: spinePath ? `url('${spinePath}')` : undefined,
        backgroundSize: spinePath ? "cover" : undefined,
        backgroundPosition: spinePath ? "center" : undefined,
        backgroundColor: spinePath ? undefined : edgeColor,
    };

    const faceRight: React.CSSProperties = {
        width: depth,
        height,
        transform: `translateX(${width}px) translateZ(${halfD}px) rotateY(90deg)`,
        backgroundImage: spinePath ? `url('${spinePath}')` : undefined,
        backgroundSize: spinePath ? "cover" : undefined,
        backgroundPosition: spinePath ? "center" : undefined,
        backgroundColor: spinePath ? undefined : edgeColor,
    };

    const faceTop: React.CSSProperties = {
        width,
        height: depth,
        transform: `translateZ(-${halfD}px) rotateX(90deg)`,
        backgroundColor: edgeColor,
    };

    const faceBottom: React.CSSProperties = {
        width,
        height: depth,
        transform: `translateY(${height}px) translateZ(${halfD}px) rotateX(-90deg)`,
        backgroundColor: edgeColor,
    };

    return (
        <div
            className="box-viewer-3d__bg"
            style={{
                ...bgStyle,
                cursor: interactive ? (isDragging ? "grabbing" : "grab") : "inherit",
            }}
            {...interactiveHandlers}
        >
            <div
                className="box-viewer-3d"
                style={{
                    width,
                    height,
                    perspective: `${perspective}px`,
                    marginTop: thumbMode ? 0 : 12,
                }}
            >
                <div
                    className="box-viewer-3d__scene"
                    style={{
                        width,
                        height,
                        transform: `scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
                    }}
                >
                    <div className="box-viewer-3d__face" style={faceFront} />
                    <div className="box-viewer-3d__face" style={faceBack} />
                    <div className="box-viewer-3d__face" style={faceLeft} />
                    <div className="box-viewer-3d__face" style={faceRight} />
                    <div className="box-viewer-3d__face" style={faceTop} />
                    <div className="box-viewer-3d__face" style={faceBottom} />
                </div>
            </div>
        </div>
    );
}
