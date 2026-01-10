import { useEffect, useRef, useState } from "react";

export type GamepadNavigationDirection = "up" | "down" | "left" | "right" | "select";

export type GamepadNavigationCallbacks = {
    onNavigate: (direction: GamepadNavigationDirection) => void;
    onSelect?: () => void;
};

const ANALOG_THRESHOLD = 0.5;
const REPEAT_DELAY = 150;

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

        const pollGamepad = () => {
            const gamepads = navigator.getGamepads();
            const gamepad = gamepads[0];

            if (!gamepad) {
                animationFrameId.current = requestAnimationFrame(pollGamepad);
                return;
            }

            const now = Date.now();
            let direction: GamepadNavigationDirection | null = null;

            const leftStickX = gamepad.axes[0];
            const leftStickY = gamepad.axes[1];
            const dpadUp = gamepad.buttons[12]?.pressed;
            const dpadDown = gamepad.buttons[13]?.pressed;
            const dpadLeft = gamepad.buttons[14]?.pressed;
            const dpadRight = gamepad.buttons[15]?.pressed;
            const aButton = gamepad.buttons[0]?.pressed;

            if (aButton && callbacksRef.current.onSelect) {
                if (lastDirection.current !== "select" || now - lastInputTime.current > REPEAT_DELAY) {
                    callbacksRef.current.onSelect();
                    lastDirection.current = "select";
                    lastInputTime.current = now;
                }
            } else if (dpadUp || leftStickY < -ANALOG_THRESHOLD) {
                direction = "up";
            } else if (dpadDown || leftStickY > ANALOG_THRESHOLD) {
                direction = "down";
            } else if (dpadLeft || leftStickX < -ANALOG_THRESHOLD) {
                direction = "left";
            } else if (dpadRight || leftStickX > ANALOG_THRESHOLD) {
                direction = "right";
            }

            if (direction) {
                if (
                    direction !== lastDirection.current ||
                    now - lastInputTime.current > REPEAT_DELAY
                ) {
                    callbacksRef.current.onNavigate(direction);
                    lastDirection.current = direction;
                    lastInputTime.current = now;
                }
            } else {
                lastDirection.current = null;
            }

            animationFrameId.current = requestAnimationFrame(pollGamepad);
        };

        animationFrameId.current = requestAnimationFrame(pollGamepad);

        return () => {
            if (animationFrameId.current !== null) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [enabled, windowFocused]);
}
