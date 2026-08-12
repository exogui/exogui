import * as React from "react";

// Mock the heavy child components so importing BrowsePage doesn't drag in
// react-virtualized (ES module issues) or the rest of the component tree.
jest.mock("../SearchBar", () => ({ SearchBar: () => null }));
jest.mock("../GameGridWithWrapping", () => ({ GameGridWithWrapping: () => null }));
jest.mock("../GameList", () => ({ GameList: () => null }));
jest.mock("../GamepadNavigationWrapper", () => ({ GamepadNavigationWrapper: () => null }));
jest.mock("../ResizableSidebar", () => ({ ResizableSidebar: () => null }));
jest.mock("../../containers/ConnectedLeftBrowseSidebar", () => ({ ConnectedLeftBrowseSidebar: () => null }));
jest.mock("../../containers/ConnectedRightBrowseSidebar", () => ({ ConnectedRightBrowseSidebar: () => null }));
// These utility modules pull in `@electron/remote`, which can't load in jsdom.
jest.mock("@renderer/util/games", () => ({
    openGameConfigDirectory: jest.fn(),
    toggleGameFavorite: jest.fn(),
}));
jest.mock("../../Util", () => ({
    gameScaleSpan: 60,
    openContextMenu: jest.fn(),
}));

import { BrowsePage } from "./BrowsePage";

/** Build a bare BrowsePage instance with a synchronous `setState` for unit testing. */
function createBrowsePage(): BrowsePage {
    const component = new BrowsePage({} as any);
    // React's real setState is a no-op on an unmounted instance, so replace it
    // with a synchronous version that mutates `state` directly.
    component.setState = ((update: any) => {
        const partial = typeof update === "function" ? update(component.state) : update;
        component.state = { ...component.state, ...partial };
    }) as any;
    return component;
}

/** Build a fake keyboard event for `onCenterKeyDown`. */
function keyEvent(
    key: string,
    options: { ctrlKey?: boolean; altKey?: boolean; tagName?: string } = {}
): React.KeyboardEvent {
    return {
        key,
        ctrlKey: options.ctrlKey ?? false,
        altKey: options.altKey ?? false,
        target: { tagName: options.tagName ?? "DIV" },
        preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;
}

describe("BrowsePage quick search overlay", () => {
    describe("updateQuickSearch", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        test("sets the quick search string", () => {
            const component = createBrowsePage();

            component.updateQuickSearch("do");

            expect(component.state.quickSearch).toBe("do");
        });

        test("clears the string after the timeout elapses (hides overlay)", () => {
            const component = createBrowsePage();

            component.updateQuickSearch("do");
            expect(component.state.quickSearch).toBe("do");

            jest.advanceTimersByTime(BrowsePage.quickSearchTimeout);

            expect(component.state.quickSearch).toBe("");
        });

        test("debounces the hide timer while typing continues", () => {
            const component = createBrowsePage();

            component.updateQuickSearch("d");
            jest.advanceTimersByTime(BrowsePage.quickSearchTimeout - 100);
            // Still visible, and a new keystroke arrives before the timeout.
            component.updateQuickSearch("do");
            jest.advanceTimersByTime(BrowsePage.quickSearchTimeout - 100);

            // The first timer must have been cancelled, so it is still showing.
            expect(component.state.quickSearch).toBe("do");

            jest.advanceTimersByTime(100);
            expect(component.state.quickSearch).toBe("");
        });

        test("clearing to empty hides immediately and leaves no pending timer", () => {
            const component = createBrowsePage();

            component.updateQuickSearch("d");
            component.updateQuickSearch("");

            expect(component.state.quickSearch).toBe("");
            expect(jest.getTimerCount()).toBe(0);
        });

        test("componentWillUnmount cancels the pending hide timer", () => {
            const component = createBrowsePage();

            component.updateQuickSearch("d");
            expect(jest.getTimerCount()).toBe(1);

            component.componentWillUnmount();

            expect(jest.getTimerCount()).toBe(0);
        });
    });

    describe("onCenterKeyDown", () => {
        test("appends a single character to the search string", () => {
            const component = createBrowsePage();
            component.updateQuickSearch = jest.fn();
            component.state = { quickSearch: "d" };
            component._prevQuickSearchUpdate = Date.now();

            const event = keyEvent("o");
            component.onCenterKeyDown(event);

            expect(component.updateQuickSearch).toHaveBeenCalledWith("do");
            expect(event.preventDefault).toHaveBeenCalled();
        });

        test("uppercase keys are lowercased before being added", () => {
            const component = createBrowsePage();
            component.updateQuickSearch = jest.fn();

            component.onCenterKeyDown(keyEvent("D"));

            expect(component.updateQuickSearch).toHaveBeenCalledWith("d");
        });

        test("backspace removes the last character", () => {
            const component = createBrowsePage();
            component.updateQuickSearch = jest.fn();
            component.state = { quickSearch: "doo" };
            component._prevQuickSearchUpdate = Date.now();

            component.onCenterKeyDown(keyEvent("Backspace"));

            expect(component.updateQuickSearch).toHaveBeenCalledWith("do");
        });

        test("resets the string when the previous input timed out", () => {
            const component = createBrowsePage();
            component.updateQuickSearch = jest.fn();
            component.state = { quickSearch: "stale" };
            // Last update was longer ago than the timeout.
            component._prevQuickSearchUpdate =
                Date.now() - BrowsePage.quickSearchTimeout - 1;

            component.onCenterKeyDown(keyEvent("n"));

            expect(component.updateQuickSearch).toHaveBeenCalledWith("n");
        });

        test("ignores keypresses while an input is focused", () => {
            const component = createBrowsePage();
            component.updateQuickSearch = jest.fn();

            component.onCenterKeyDown(keyEvent("a", { tagName: "INPUT" }));
            component.onCenterKeyDown(keyEvent("a", { tagName: "TEXTAREA" }));

            expect(component.updateQuickSearch).not.toHaveBeenCalled();
        });

        test("ignores ctrl/alt modified keypresses", () => {
            const component = createBrowsePage();
            component.updateQuickSearch = jest.fn();

            component.onCenterKeyDown(keyEvent("a", { ctrlKey: true }));
            component.onCenterKeyDown(keyEvent("a", { altKey: true }));

            expect(component.updateQuickSearch).not.toHaveBeenCalled();
        });

        test("ignores a leading space", () => {
            const component = createBrowsePage();
            component.updateQuickSearch = jest.fn();
            component.state = { quickSearch: "" };

            component.onCenterKeyDown(keyEvent(" "));

            expect(component.updateQuickSearch).not.toHaveBeenCalled();
        });
    });
});
