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

type InputHandler = (input: string, key: Record<string, boolean>) => void;
type InputRegistration = [InputHandler, { isActive?: boolean } | undefined];

/**
 * Ink hands a key to every active `useInput` handler, and the hook registers two
 * of them per render (the action row's, then its own). Re-render first so only
 * the current render's registrations are dispatched, exactly as the terminal
 * would — targeting the last one alone silently drops arrow keys.
 */
function press(rerender: () => void, key: Record<string, boolean>): void {
  useInputMock.mockClear();
  rerender();
  const registrations = useInputMock.mock.calls as InputRegistration[];

  act(() => {
    for (const [handler, options] of registrations) {
      if (options?.isActive === false) continue;
      handler("", key);
    }
  });
}

describe("useSettingsZone", () => {
  test("skips disabled Save buttons when moving across the button row", () => {
    useInputMock.mockReset();
    const { result, rerender } = renderHook(() =>
      useSettingsZone({ buttonCount: 2, disabledButtons: [1] }),
    );

    press(rerender, { tab: true });
    expect(result.current.isButtonActive(0)).toBe(true);
    expect(result.current.isButtonActive(1)).toBe(false);

    press(rerender, { rightArrow: true });
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
