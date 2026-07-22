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

import { useActionRow } from "./use-action-row";

function getActiveHandler(): ((input: string, key: Record<string, boolean>) => void) | null {
  const lastCall = useInputMock.mock.calls.at(-1);
  return lastCall?.[0] ?? null;
}

describe("useActionRow", () => {
  test("moves activeIndex with arrow keys, skipping disabled actions and clamping at both boundaries", () => {
    useInputMock.mockReset();
    const { result } = renderHook(() =>
      useActionRow({
        actionCount: 4,
        disabledActions: [false, true, false, false],
        onAction: vi.fn(),
      }),
    );

    expect(result.current.activeIndex).toBe(0);
    expect(result.current.isActionActive(0)).toBe(true);
    expect(result.current.isActionActive(1)).toBe(false);

    act(() => {
      getActiveHandler()?.("", { rightArrow: true });
    });
    expect(result.current.activeIndex).toBe(2);
    expect(result.current.isActionActive(2)).toBe(true);
    expect(result.current.isActionActive(1)).toBe(false);

    act(() => {
      getActiveHandler()?.("", { rightArrow: true });
    });
    expect(result.current.activeIndex).toBe(3);

    act(() => {
      getActiveHandler()?.("", { rightArrow: true });
    });
    expect(result.current.activeIndex).toBe(3);
    expect(result.current.isActionActive(3)).toBe(true);

    act(() => {
      getActiveHandler()?.("", { leftArrow: true });
    });
    expect(result.current.activeIndex).toBe(2);

    act(() => {
      getActiveHandler()?.("", { leftArrow: true });
    });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.isActionActive(1)).toBe(false);

    act(() => {
      getActiveHandler()?.("", { leftArrow: true });
    });
    expect(result.current.activeIndex).toBe(0);
  });
});
