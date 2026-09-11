import { readGamepadsInput } from "./useGamepadNavigation";

type FakeGamepadOptions = {
    connected?: boolean;
    buttons?: number[];
    axes?: number[];
};

function fakeGamepad(options: FakeGamepadOptions = {}): Gamepad {
    const pressed = new Set(options.buttons ?? []);
    const buttons = Array.from({ length: 16 }, (_, index) => ({
        pressed: pressed.has(index),
        touched: pressed.has(index),
        value: pressed.has(index) ? 1 : 0,
    }));
    return {
        connected: options.connected ?? true,
        buttons,
        axes: options.axes ?? [0, 0, 0, 0],
    } as unknown as Gamepad;
}

const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_RIGHT = 15;
const BUTTON_A = 0;

describe("readGamepadsInput", () => {
    it("returns no input when nothing is connected", () => {
        expect(readGamepadsInput([null, null])).toEqual({
            select: false,
            direction: null,
        });
    });

    it("reads the dpad of the first gamepad", () => {
        expect(readGamepadsInput([fakeGamepad({ buttons: [DPAD_UP] })])).toEqual({
            select: false,
            direction: "up",
        });
    });

    it("reads a gamepad in a later slot when the first slot is empty", () => {
        expect(
            readGamepadsInput([null, fakeGamepad({ buttons: [DPAD_DOWN] })])
        ).toEqual({ select: false, direction: "down" });
    });

    it("reads a gamepad in a later slot while an idle gamepad holds the first slot", () => {
        expect(
            readGamepadsInput([
                fakeGamepad(),
                fakeGamepad({ buttons: [DPAD_RIGHT] }),
            ])
        ).toEqual({ select: false, direction: "right" });
    });

    it("reads the select button from any gamepad", () => {
        expect(
            readGamepadsInput([fakeGamepad(), fakeGamepad({ buttons: [BUTTON_A] })])
        ).toEqual({ select: true, direction: null });
    });

    it("reads the analog stick of a gamepad in a later slot", () => {
        expect(
            readGamepadsInput([fakeGamepad(), fakeGamepad({ axes: [0, -0.9] })])
        ).toEqual({ select: false, direction: "up" });
    });

    it("ignores analog movement below the threshold", () => {
        expect(readGamepadsInput([fakeGamepad({ axes: [0.4, 0.4] })])).toEqual({
            select: false,
            direction: null,
        });
    });

    it("ignores disconnected gamepads", () => {
        expect(
            readGamepadsInput([
                fakeGamepad({ connected: false, buttons: [DPAD_UP, BUTTON_A] }),
            ])
        ).toEqual({ select: false, direction: null });
    });

    it("keeps the first gamepad's direction when several are pushed at once", () => {
        expect(
            readGamepadsInput([
                fakeGamepad({ buttons: [DPAD_UP] }),
                fakeGamepad({ buttons: [DPAD_DOWN] }),
            ])
        ).toEqual({ select: false, direction: "up" });
    });
});
