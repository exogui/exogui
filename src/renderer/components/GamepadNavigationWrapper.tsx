import * as React from "react";
import { GamepadNavigationDirection, useGamepadNavigation } from "../hooks/useGamepadNavigation";

export type GamepadNavigationWrapperProps = {
    children: React.ReactNode;
    enabled?: boolean;
    onSelect?: () => void;
};

export function GamepadNavigationWrapper(props: GamepadNavigationWrapperProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const { onSelect, enabled = true } = props;

    const dispatchKeyboardEvent = React.useCallback((key: string) => {
        console.log(`[GamepadNavigationWrapper] dispatchKeyboardEvent called: key=${key}`);
        if (!containerRef.current) {
            console.log("[GamepadNavigationWrapper] containerRef.current is null");
            return;
        }

        const event = new KeyboardEvent("keydown", {
            key: key,
            code: key,
            bubbles: true,
            cancelable: true,
        });

        const focusedElement = containerRef.current.querySelector(".game-grid, .game-list");
        console.log("[GamepadNavigationWrapper] focusedElement:", focusedElement);
        if (focusedElement) {
            console.log("[GamepadNavigationWrapper] Dispatching event to element");
            focusedElement.dispatchEvent(event);
        } else {
            console.log("[GamepadNavigationWrapper] No focusedElement found!");
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
        console.log("[GamepadNavigationWrapper] handleSelect called, calling onSelect");
        if (onSelect) {
            onSelect();
        }
    }, [onSelect]);

    useGamepadNavigation(
        {
            onNavigate: handleNavigate,
            onSelect: handleSelect,
        },
        enabled
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
