import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn().mockReturnValue({
    settings: null,
    isLoading: false,
  }),
}));

import { useReviewSettings } from "./use-review-settings";
import { useSettings } from "@/hooks/use-settings";

const mockUseSettings = useSettings as ReturnType<typeof vi.fn>;

const FALLBACK_LENSES = ["correctness", "security", "performance", "simplicity", "tests"];

describe("useReviewSettings", () => {
  it("should return fallback lenses when settings is null", () => {
    mockUseSettings.mockReturnValue({ settings: null, isLoading: false });

    const { result } = renderHook(() => useReviewSettings());

    expect(result.current.defaultLenses).toEqual(FALLBACK_LENSES);
  });

  it("should return valid lenses unchanged", () => {
    mockUseSettings.mockReturnValue({
      settings: { defaultLenses: ["correctness", "security"] },
      isLoading: false,
    });

    const { result } = renderHook(() => useReviewSettings());

    expect(result.current.defaultLenses).toEqual(["correctness", "security"]);
  });

  it("should filter out invalid lenses", () => {
    mockUseSettings.mockReturnValue({
      settings: { defaultLenses: ["correctness", "invalid-lens", "security"] },
      isLoading: false,
    });

    const { result } = renderHook(() => useReviewSettings());

    expect(result.current.defaultLenses).toEqual(["correctness", "security"]);
  });

  it("should return fallback when all lenses are invalid", () => {
    mockUseSettings.mockReturnValue({
      settings: { defaultLenses: ["foo", "bar"] },
      isLoading: false,
    });

    const { result } = renderHook(() => useReviewSettings());

    expect(result.current.defaultLenses).toEqual(FALLBACK_LENSES);
  });
});
