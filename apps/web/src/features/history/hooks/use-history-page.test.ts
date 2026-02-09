import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReviewMetadata } from "@stargazer/schemas/review";

const mockNavigate = vi.fn();
const mockUseHistoryKeyboard = vi.fn();
const mockUseReviews = vi.fn();
const mockUseReviewDetail = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/history" }),
}));

vi.mock("./use-history-keyboard", () => ({
  useHistoryKeyboard: (args: unknown) => mockUseHistoryKeyboard(args),
}));

vi.mock("./use-reviews", () => ({
  useReviews: () => mockUseReviews(),
}));

vi.mock("./use-review-detail", () => ({
  useReviewDetail: (reviewId: string | null) => mockUseReviewDetail(reviewId),
}));

import { useHistoryPage } from "./use-history-page";

function createReview(id: string, createdAt: string): ReviewMetadata {
  return {
    id,
    projectPath: "/repo",
    createdAt,
    mode: "staged",
    branch: "main",
    profile: null,
    lenses: [],
    issueCount: 0,
    blockerCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    nitCount: 0,
    fileCount: 1,
    durationMs: 1200,
  };
}

describe("useHistoryPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseHistoryKeyboard.mockReset();
    mockUseReviews.mockReset();
    mockUseReviewDetail.mockReset();

    mockUseReviews.mockReturnValue({
      reviews: [
        createReview("11111111-1111-4111-8111-111111111111", "2026-02-07T10:00:00.000Z"),
        createReview("22222222-2222-4222-8222-222222222222", "2026-02-07T11:00:00.000Z"),
      ],
      isLoading: false,
      error: null,
    });
    mockUseReviewDetail.mockReturnValue({ review: null, isLoading: false });
  });

  it("moves focus to search when runs list hits upper boundary", () => {
    const { result } = renderHook(() => useHistoryPage());
    const focusSpy = vi.fn();

    result.current.searchInputRef.current = { focus: focusSpy } as unknown as HTMLInputElement;

    act(() => {
      result.current.handleRunsBoundary("up");
    });

    expect(result.current.focusZone).toBe("search");
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("moves focus to search when timeline list hits upper boundary", () => {
    const { result } = renderHook(() => useHistoryPage());
    const focusSpy = vi.fn();

    result.current.searchInputRef.current = { focus: focusSpy } as unknown as HTMLInputElement;

    act(() => {
      result.current.handleTimelineBoundary("up");
    });

    expect(result.current.focusZone).toBe("search");
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("sets first run as active when current selection is outside filtered runs", async () => {
    const oldRunId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const newRunId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    mockUseReviews.mockReturnValue({
      reviews: [
        createReview(oldRunId, "2026-02-06T10:00:00.000Z"),
        createReview(newRunId, "2026-02-07T11:00:00.000Z"),
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useHistoryPage());

    await waitFor(() => {
      expect(result.current.selectedRunId).toBe(newRunId);
    });
  });
});
