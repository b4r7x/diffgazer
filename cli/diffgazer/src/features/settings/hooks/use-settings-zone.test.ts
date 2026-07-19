/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const useInputMock = vi.hoisted(() => vi.fn());

// Boundary mock: Ink terminal input hook.
vi.mock("ink", () => ({
  useInput: useInputMock,
}));

import { getSettingsFooter, useSettingsZone } from "./use-settings-zone";

function getActiveHandler(): ((input: string, key: Record<string, boolean>) => void) | null {
  const lastCall = useInputMock.mock.calls.at(-1);
  return lastCall?.[0] ?? null;
}

describe("useSettingsZone", () => {
  test("skips disabled Save buttons when moving across the button row", () => {
    useInputMock.mockReset();
    const { result } = renderHook(() => useSettingsZone({ buttonCount: 2, disabledButtons: [1] }));

    act(() => {
      getActiveHandler()?.("", { tab: true });
    });
    expect(result.current.isButtonActive(0)).toBe(true);
    expect(result.current.isButtonActive(1)).toBe(false);

    act(() => {
      getActiveHandler()?.("", { rightArrow: true });
    });
    expect(result.current.isButtonActive(0)).toBe(true);
    expect(result.current.isButtonActive(1)).toBe(false);
  });
});

describe("getSettingsFooter", () => {
  test("describes list controls while the list zone is active", () => {
    expect(
      getSettingsFooter({
        zone: "list",
        listShortcuts: [{ key: "Space", label: "Toggle" }],
        buttonActionLabel: "Save",
      }),
    ).toEqual({
      shortcuts: [
        { key: "Space", label: "Toggle" },
        { key: "Tab", label: "Switch Zone" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    });
  });

  test("describes the focused button action while the button zone is active", () => {
    expect(
      getSettingsFooter({
        zone: "buttons",
        listShortcuts: [],
        buttonActionLabel: "Save Changes",
        buttonActionDisabled: true,
      }),
    ).toEqual({
      shortcuts: [
        { key: "←/→", label: "Move Action" },
        { key: "Enter", label: "Save Changes", disabled: true },
        { key: "Tab", label: "Switch Zone" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    });
  });
});
