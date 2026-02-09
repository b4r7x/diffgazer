import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockUsePageFooter = vi.fn();

vi.mock("@diffgazer/keyboard", () => ({
  useFocusZone: () => ({ zone: "progress" }),
  useKey: vi.fn(),
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: (args: unknown) => mockUsePageFooter(args),
}));

import { useReviewProgressKeyboard } from "./use-review-progress-keyboard";

describe("useReviewProgressKeyboard footer", () => {
  beforeEach(() => {
    mockUsePageFooter.mockReset();
  });

  it("hides inactive action hints when callbacks are missing", () => {
    renderHook(() => useReviewProgressKeyboard({}));

    expect(mockUsePageFooter).toHaveBeenCalledWith({
      shortcuts: [{ key: "←/→", label: "Switch Pane" }],
      rightShortcuts: [],
    });
  });

  it("shows Enter/Esc hints only when callbacks are wired", () => {
    renderHook(() => useReviewProgressKeyboard({
      onViewResults: vi.fn(),
      onCancel: vi.fn(),
    }));

    expect(mockUsePageFooter).toHaveBeenCalledWith({
      shortcuts: [
        { key: "←/→", label: "Switch Pane" },
        { key: "Enter", label: "View Results" },
      ],
      rightShortcuts: [{ key: "Esc", label: "Cancel" }],
    });
  });
});

