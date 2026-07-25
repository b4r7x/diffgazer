/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const useInputMock = vi.hoisted(() => vi.fn());

// Boundary mock: Ink terminal input hook.
vi.mock("ink", () => ({
  useInput: useInputMock,
}));

import type { ListNavigation, ListNavigationItem } from "./use-list-navigation";
import { useListNavigationInput } from "./use-list-navigation-input";

function press(input: string, key: Record<string, boolean> = {}) {
  const handler = useInputMock.mock.calls.at(-1)?.[0];
  handler?.(input, key);
}

function createNavigation(highlighted: ListNavigationItem | null = { id: "a", disabled: false }) {
  return {
    currentHighlightedId: highlighted?.id ?? "",
    moveBy: vi.fn(),
    selectItem: vi.fn(() => highlighted),
  } satisfies ListNavigation;
}

describe("useListNavigationInput", () => {
  test("vertical orientation moves on up/down and ignores left/right", () => {
    useInputMock.mockReset();
    const navigation = createNavigation();
    renderHook(() => useListNavigationInput({ navigation, isActive: true }));

    press("", { upArrow: true });
    expect(navigation.moveBy).toHaveBeenLastCalledWith(-1);

    press("", { downArrow: true });
    expect(navigation.moveBy).toHaveBeenLastCalledWith(1);

    press("", { leftArrow: true });
    press("", { rightArrow: true });
    expect(navigation.moveBy).toHaveBeenCalledTimes(2);
  });

  test("horizontal orientation moves on left/right and ignores up/down", () => {
    useInputMock.mockReset();
    const navigation = createNavigation();
    renderHook(() =>
      useListNavigationInput({ navigation, isActive: true, orientation: "horizontal" }),
    );

    press("", { leftArrow: true });
    expect(navigation.moveBy).toHaveBeenLastCalledWith(-1);

    press("", { rightArrow: true });
    expect(navigation.moveBy).toHaveBeenLastCalledWith(1);

    press("", { upArrow: true });
    press("", { downArrow: true });
    expect(navigation.moveBy).toHaveBeenCalledTimes(2);
  });

  test("activates the highlighted item on Enter, and on Space only when opted in", () => {
    useInputMock.mockReset();
    const item = { id: "a", disabled: false };
    const navigation = createNavigation(item);
    const onActivate = vi.fn();
    renderHook(() => useListNavigationInput({ navigation, isActive: true, onActivate }));

    press("", { return: true });
    expect(onActivate).toHaveBeenCalledWith(item);

    press(" ", {});
    expect(onActivate).toHaveBeenCalledTimes(1);

    useInputMock.mockReset();
    const spaceActivate = vi.fn();
    renderHook(() =>
      useListNavigationInput({
        navigation,
        isActive: true,
        activateOnSpace: true,
        onActivate: spaceActivate,
      }),
    );

    press(" ", {});
    expect(spaceActivate).toHaveBeenCalledWith(item);
  });

  test("skips activation when nothing selectable is highlighted", () => {
    useInputMock.mockReset();
    const navigation = createNavigation(null);
    const onActivate = vi.fn();
    renderHook(() => useListNavigationInput({ navigation, isActive: true, onActivate }));

    press("", { return: true });
    expect(onActivate).not.toHaveBeenCalled();
  });

  test("forwards isActive to Ink so inactive lists ignore input", () => {
    useInputMock.mockReset();
    renderHook(() => useListNavigationInput({ navigation: createNavigation(), isActive: false }));

    expect(useInputMock.mock.calls.at(-1)?.[1]).toEqual({ isActive: false });
  });
});
