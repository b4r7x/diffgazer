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

import { useSettingsZone } from "./use-settings-zone";

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
