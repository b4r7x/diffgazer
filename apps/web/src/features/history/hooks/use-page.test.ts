import {
  HISTORY_SECTION_ALL_ID,
  type HistoryScreenState,
  resolveSelectedDateId,
  resolveSelectedId,
} from "@diffgazer/core/review";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Run } from "@/features/history/types";
import { useHistoryPage } from "./use-page";

const { mockNavigate, mockUseHistoryScreenState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseHistoryScreenState: vi.fn(),
}));

vi.mock("@diffgazer/core/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/review")>()),
  useHistoryScreenState: mockUseHistoryScreenState,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/use-scoped-route-state", () => ({
  useScopedRouteState: <T>(_key: string, defaultValue: T) => [defaultValue, vi.fn()],
}));

function makeRun(id: string): Run {
  return {
    id,
    displayId: `#${id}`,
    branch: "Main",
    timestamp: "Today",
    summary: "Passed",
  };
}

describe("history selection resolution", () => {
  it("derives a valid date without mutating route state", () => {
    const timelineItems = [
      { id: HISTORY_SECTION_ALL_ID, label: "All", count: 2 },
      { id: "2026-02-09", label: "Feb 9", count: 1 },
    ];

    expect(resolveSelectedDateId("2026-02-09", timelineItems)).toBe("2026-02-09");
    expect(resolveSelectedDateId("missing", timelineItems)).toBe(HISTORY_SECTION_ALL_ID);
  });

  it("derives a valid run from the filtered run list", () => {
    const runs = [makeRun("run-a"), makeRun("run-b")];

    expect(resolveSelectedId("run-b", runs)).toBe("run-b");
    expect(resolveSelectedId("missing", runs)).toBe("run-a");
    expect(resolveSelectedId("missing", [])).toBeNull();
  });
});

describe("useHistoryPage run pointer activation", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseHistoryScreenState.mockReset();
  });

  it("navigates with the run id when a selected run is tapped a second time", () => {
    let selectedRunId = "run-a";
    mockUseHistoryScreenState.mockImplementation(
      () =>
        ({
          reviewsQuery: { isSuccess: true },
          reviewDetailQuery: { isLoading: false, isError: false },
          reviews: [],
          timelineItems: [],
          selectedDateId: HISTORY_SECTION_ALL_ID,
          setSelectedDateId: vi.fn(),
          searchQuery: "",
          setSearchQuery: vi.fn(),
          mappedRuns: [makeRun("run-a"), makeRun("run-b")],
          selectedRunId,
          setSelectedRunId: (id: string) => {
            selectedRunId = id;
          },
          selectedRun: null,
          severityCounts: null,
          sortedIssues: [],
          duration: "",
          hasReviews: true,
          hasSearchQuery: false,
          emptyRunsMessage: "",
          hasMoreReviews: false,
          isLoadingMoreReviews: false,
          loadMoreReviews: vi.fn(),
        }) as unknown as HistoryScreenState,
    );

    const { result, rerender } = renderHook(() => useHistoryPage());

    act(() => result.current.handleRunSelect("run-b"));
    expect(mockNavigate).not.toHaveBeenCalled();
    rerender();

    act(() => result.current.handleRunSelect("run-b"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "run-b" },
    });
  });
});
