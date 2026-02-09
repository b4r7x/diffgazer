import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shortcut } from "@diffgazer/schemas/ui";

const mockSetShortcuts = vi.fn();
const mockSetRightShortcuts = vi.fn();

let currentShortcuts: Shortcut[] = [];
let currentRightShortcuts: Shortcut[] = [];

vi.mock("@/components/layout", () => ({
  useFooterData: () => ({
    shortcuts: currentShortcuts,
    rightShortcuts: currentRightShortcuts,
  }),
  useFooterActions: () => ({
    setShortcuts: mockSetShortcuts,
    setRightShortcuts: mockSetRightShortcuts,
  }),
}));

import { usePageFooter } from "./use-page-footer";

describe("usePageFooter", () => {
  beforeEach(() => {
    mockSetShortcuts.mockReset();
    mockSetRightShortcuts.mockReset();
    currentShortcuts = [];
    currentRightShortcuts = [];
  });

  it("sets footer shortcuts when content changed", () => {
    const nextShortcuts: Shortcut[] = [{ key: "Enter", label: "Confirm" }];
    const nextRight: Shortcut[] = [{ key: "Esc", label: "Back" }];

    renderHook(() => usePageFooter({ shortcuts: nextShortcuts, rightShortcuts: nextRight }));

    expect(mockSetShortcuts).toHaveBeenCalledWith(nextShortcuts);
    expect(mockSetRightShortcuts).toHaveBeenCalledWith(nextRight);
  });

  it("does not set footer shortcuts when content is equal with new array references", () => {
    currentShortcuts = [{ key: "Enter", label: "Confirm" }];
    currentRightShortcuts = [{ key: "Esc", label: "Back" }];

    const { rerender } = renderHook(
      ({ shortcuts, rightShortcuts }) => usePageFooter({ shortcuts, rightShortcuts }),
      {
        initialProps: {
          shortcuts: [{ key: "Enter", label: "Confirm" }] satisfies Shortcut[],
          rightShortcuts: [{ key: "Esc", label: "Back" }] satisfies Shortcut[],
        },
      },
    );

    rerender({
      shortcuts: [{ key: "Enter", label: "Confirm" }],
      rightShortcuts: [{ key: "Esc", label: "Back" }],
    });

    expect(mockSetShortcuts).not.toHaveBeenCalled();
    expect(mockSetRightShortcuts).not.toHaveBeenCalled();
  });

  it("treats disabled flag changes as a footer update", () => {
    currentShortcuts = [{ key: "Enter", label: "Confirm", disabled: false }];

    const nextShortcuts: Shortcut[] = [{ key: "Enter", label: "Confirm", disabled: true }];

    renderHook(() => usePageFooter({ shortcuts: nextShortcuts }));

    expect(mockSetShortcuts).toHaveBeenCalledWith(nextShortcuts);
  });
});
