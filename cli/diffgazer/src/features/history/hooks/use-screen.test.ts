/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHistoryScreen } from "./use-screen.js";

const useHistoryScreenStateMock = vi.hoisted(() => vi.fn());

// Boundary mock: @diffgazer/core/review owns the shared history data pipeline; this TUI adapter test provides its public hook output.
vi.mock("@diffgazer/core/review", () => ({
  useHistoryScreenState: useHistoryScreenStateMock,
}));

describe("useHistoryScreen", () => {
  it("opens a saved review by reviewId without starting a new unstaged review", () => {
    const onOpenReview = vi.fn();
    useHistoryScreenStateMock.mockReturnValue({
      reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
      reviews: [],
      timelineItems: [],
      selectedDateId: "all",
      setSelectedDateId: vi.fn(),
      searchQuery: "",
      setSearchQuery: vi.fn(),
      mappedRuns: [],
      selectedRunId: "history-review-1",
      setSelectedRunId: vi.fn(),
      selectedRun: null,
      severityCounts: null,
      sortedIssues: [],
      duration: "",
      hasReviews: true,
      hasSearchQuery: false,
      emptyRunsMessage: "No runs yet",
    });

    const { result } = renderHook(() => useHistoryScreen({ onOpenReview }));

    result.current.handleRunActivate("history-review-1");

    expect(onOpenReview).toHaveBeenCalledWith("history-review-1");
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });
});
