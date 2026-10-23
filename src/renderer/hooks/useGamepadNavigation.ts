import { useEffect, useRef, useState } from "react";

export type GamepadNavigationDirection = "up" | "down" | "left" | "right" | "select";

export type GamepadDirection = Exclude<GamepadNavigationDirection, "select">;

export type GamepadInputState = {
    select: boolean;
    direction: GamepadDirection | null;
};

export type GamepadNavigationCallbacks = {
    onNavigate: (direction: GamepadNavigationDirection) => void;
    onSelect?: () => void;
};

const ANALOG_THRESHOLD = 0.5;
const REPEAT_DELAY = 150;

const BUTTON_A = 0;
const BUTTON_DPAD_UP = 12;
const BUTTON_DPAD_DOWN = 13;
const BUTTON_DPAD_LEFT = 14;
const BUTTON_DPAD_RIGHT = 15;

const AXIS_LEFT_STICK_X = 0;
const AXIS_LEFT_STICK_Y = 1;

function readGamepadDirection(gamepad: Gamepad): GamepadDirection | null {
    const leftStickX = gamepad.axes[AXIS_LEFT_STICK_X] ?? 0;
    const leftStickY = gamepad.axes[AXIS_LEFT_STICK_Y] ?? 0;

    if (gamepad.buttons[BUTTON_DPAD_UP]?.pressed || leftStickY < -ANALOG_THRESHOLD) {
        return "up";
    }
    if (gamepad.buttons[BUTTON_DPAD_DOWN]?.pressed || leftStickY > ANALOG_THRESHOLD) {
        return "down";
    }
    if (gamepad.buttons[BUTTON_DPAD_LEFT]?.pressed || leftStickX < -ANALOG_THRESHOLD) {
        return "left";
    }
    if (gamepad.buttons[BUTTON_DPAD_RIGHT]?.pressed || leftStickX > ANALOG_THRESHOLD) {
        return "right";
    }
    return null;
}

/**
 * Combine the input of every connected gamepad, so any of them can drive the UI
 * (on a Steam Deck the built-in controls take slot 0 and an external pad lands
 * in a later slot).
 */
export function readGamepadsInput(
    gamepads: ReadonlyArray<Gamepad | null>
): GamepadInputState {
    const state: GamepadInputState = { select: false, direction: null };

    for (const gamepad of gamepads) {
        if (!gamepad || !gamepad.connected) {
            continue;
        }
        if (gamepad.buttons[BUTTON_A]?.pressed) {
            state.select = true;
        }
        if (!state.direction) {
            state.direction = readGamepadDirection(gamepad);
        }
    }

    return state;
}

export function useGamepadNavigation(
    callbacks: GamepadNavigationCallbacks,
    enabled: boolean = true
) {
    const lastInputTime = useRef<number>(0);
    const lastDirection = useRef<GamepadNavigationDirection | null>(null);
    const animationFrameId = useRef<number | null>(null);
    const [windowFocused, setWindowFocused] = useState(() =>
        typeof document !== "undefined" ? document.hasFocus() : true
    );

    const callbacksRef = useRef(callbacks);

    useEffect(() => {
        callbacksRef.current = callbacks;
    }, [callbacks]);

    useEffect(() => {
        const handleFocus = () => setWindowFocused(true);
        const handleBlur = () => setWindowFocused(false);

        window.addEventListener("focus", handleFocus);
        window.addEventListener("blur", handleBlur);

        return () => {
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("blur", handleBlur);
        };
    }, []);

    useEffect(() => {
        if (!enabled || !windowFocused) {
            return;
        }

        const pollGamepads = () => {
            const { select, direction } = readGamepadsInput(navigator.getGamepads());
            const onSelect = callbacksRef.current.onSelect;
            const input: GamepadNavigationDirection | null =
                select && onSelect ? "select" : direction;

            if (input) {
                const now = Date.now();
                if (
                    input !== lastDirection.current ||
                    now - lastInputTime.current > REPEAT_DELAY
                ) {
                    if (input === "select") {
                        onSelect?.();
                    } else {
                        callbacksRef.current.onNavigate(input);
                    }
                    lastDirection.current = input;
                    lastInputTime.current = now;
                }
            } else {
                lastDirection.current = null;
            }

            animationFrameId.current = requestAnimationFrame(pollGamepads);
        };

        animationFrameId.current = requestAnimationFrame(pollGamepads);

        return () => {
            if (animationFrameId.current !== null) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [enabled, windowFocused]);
}
