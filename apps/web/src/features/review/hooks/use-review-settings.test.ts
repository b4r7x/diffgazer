import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@diffgazer/api/hooks", () => ({
  useSettings: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
  }),
}));

import { useReviewSettings } from "./use-review-settings";
import { useSettings } from "@diffgazer/api/hooks";

const mockUseSettings = useSettings as ReturnType<typeof vi.fn>;

const FALLBACK_LENSES = ["correctness", "security", "performance", "simplicity", "tests"];

describe("useReviewSettings", () => {
  it("should return fallback lenses when settings is null", () => {
    mockUseSettings.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() => useReviewSettings());

    expect(result.current.defaultLenses).toEqual(FALLBACK_LENSES);
  });

  it("should return valid lenses unchanged", () => {
    mockUseSettings.mockReturnValue({
      data: { defaultLenses: ["correctness", "security"] },
      isLoading: false,
    });

    const { result } = renderHook(() => useReviewSettings());

    expect(result.current.defaultLenses).toEqual(["correctness", "security"]);
  });

  it("should filter out invalid lenses", () => {
    mockUseSettings.mockReturnValue({
      data: { defaultLenses: ["correctness", "invalid-lens", "security"] },
      isLoading: false,
    });

    const { result } = renderHook(() => useReviewSettings());

    expect(result.current.defaultLenses).toEqual(["correctness", "security"]);
  });

  it("should return fallback when all lenses are invalid", () => {
    mockUseSettings.mockReturnValue({
      data: { defaultLenses: ["foo", "bar"] },
      isLoading: false,
    });

    const { result } = renderHook(() => useReviewSettings());

    expect(result.current.defaultLenses).toEqual(FALLBACK_LENSES);
  });
});
