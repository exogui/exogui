import * as React from "react";
import { GamepadNavigationDirection, useGamepadNavigation } from "../hooks/useGamepadNavigation";

export type GamepadNavigationWrapperProps = {
    children: React.ReactNode;
    enabled?: boolean;
};

export function GamepadNavigationWrapper(props: GamepadNavigationWrapperProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);

    const dispatchKeyboardEvent = React.useCallback((key: string) => {
        if (!containerRef.current) return;

        const event = new KeyboardEvent("keydown", {
            key: key,
            code: key,
            bubbles: true,
            cancelable: true,
        });

        const focusedElement = containerRef.current.querySelector(".game-grid, .game-list");
        if (focusedElement) {
            focusedElement.dispatchEvent(event);
        }
    }, []);

    const handleNavigate = React.useCallback((direction: GamepadNavigationDirection) => {
        switch (direction) {
            case "up":
                dispatchKeyboardEvent("ArrowUp");
                break;
            case "down":
                dispatchKeyboardEvent("ArrowDown");
                break;
            case "left":
                dispatchKeyboardEvent("ArrowLeft");
                break;
            case "right":
                dispatchKeyboardEvent("ArrowRight");
                break;
        }
    }, [dispatchKeyboardEvent]);

    const handleSelect = React.useCallback(() => {
        dispatchKeyboardEvent("Enter");
    }, [dispatchKeyboardEvent]);

    useGamepadNavigation(
        {
            onNavigate: handleNavigate,
            onSelect: handleSelect,
        },
        props.enabled !== false
    );

    return (
        <div
            ref={containerRef}
            style={{
                height: "100%",
                width: "100%",
                display: "flex",
                flexDirection: "column"
            }}
        >
            {props.children}
        </div>
    );
}
