import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const { keyHandlers, mockSetZone, focusZone } = vi.hoisted(() => ({
  keyHandlers: new Map<string, () => void>(),
  mockSetZone: vi.fn(),
  focusZone: { value: "radios" as "radios" | "input" | "footer" },
}));

vi.mock("@diffgazer/keys", () => ({
  useScope: vi.fn(),
  useFocusZone: () => ({
    zone: focusZone.value,
    setZone: mockSetZone,
    inZone: (...zones: string[]) => zones.includes(focusZone.value),
  }),
  useKey: (key: string, handler: () => void, options?: { enabled?: boolean }) => {
    if (options?.enabled === false) return;
    keyHandlers.set(key, handler);
  },
}));

import { useApiKeyDialogKeyboard } from "./use-api-key-dialog-keyboard";

function press(key: string) {
  const handler = keyHandlers.get(key);
  if (!handler) throw new Error(`Missing handler for key "${key}"`);
  handler();
}

describe("useApiKeyDialogKeyboard", () => {
  beforeEach(() => {
    keyHandlers.clear();
    mockSetZone.mockReset();
    focusZone.value = "radios";
  });

  it("submits the focused env method without waiting for method state to re-render", () => {
    const setMethod = vi.fn();
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useApiKeyDialogKeyboard({
        open: true,
        method: "paste",
        setMethod,
        canSubmit: false,
        inputRef: { current: null },
        onSubmit,
        onClose: vi.fn(),
      }),
    );

    act(() => result.current.setFocused("env"));
    act(() => press("Enter"));

    expect(setMethod).toHaveBeenCalledWith("env");
    expect(onSubmit).toHaveBeenCalledWith("env");
  });
});
