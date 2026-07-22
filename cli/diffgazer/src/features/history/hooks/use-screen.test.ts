/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { cleanup, render } from "ink-testing-library";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationContext } from "../../../hooks/use-navigation";
import { buildResponsiveResult, getBreakpointTier } from "../../../lib/breakpoints";
import { CliThemeProvider } from "../../../theme/provider";
import { HistoryScreen } from "../components/screen";
import { useHistoryScreen } from "./use-screen";

const useHistoryScreenStateMock = vi.hoisted(() => vi.fn());
const terminalSize = vi.hoisted(() => ({ columns: 100, rows: 30 }));
const SUPPORT_FLOOR = { columns: 80, rows: 24 } as const;
const reviewDetailQuery = {
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

// Boundary mock: @diffgazer/core/review owns the shared history data pipeline; this TUI adapter test provides its public hook output.
vi.mock("@diffgazer/core/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/review")>()),
  useHistoryScreenState: useHistoryScreenStateMock,
}));

vi.mock("@diffgazer/core/footer", () => ({
  usePageFooter: vi.fn(),
}));

vi.mock("../../../components/layout/global", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../components/layout/global")>()),
  useContentZone: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    contentColumns: terminalSize.columns,
    contentRows: terminalSize.rows - 4,
  }),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    ...buildResponsiveResult(getBreakpointTier(terminalSize.columns)),
  }),
}));

beforeEach(() => {
  terminalSize.columns = 100;
  terminalSize.rows = 30;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setHistoryQuery(reviewsQuery: {
  data?: { reviews: never[] };
  isLoading: boolean;
  error: Error | null;
}) {
  useHistoryScreenStateMock.mockReturnValue({
    reviewsQuery,
    reviewDetailQuery,
    reviews: [],
    timelineItems: [],
    selectedDateId: "all",
    setSelectedDateId: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    mappedRuns: [],
    selectedRunId: null,
    setSelectedRunId: vi.fn(),
    selectedRun: null,
    severityCounts: null,
    sortedIssues: [],
    duration: "",
    hasReviews: false,
    hasSearchQuery: false,
    emptyRunsMessage: "No runs yet",
    hasMoreReviews: false,
    isLoadingMoreReviews: false,
    loadMoreReviews: vi.fn(),
  });
}

describe("useHistoryScreen", () => {
  it.each([
    ["loading", { data: undefined, isLoading: true, error: null }],
    ["error", { data: undefined, isLoading: false, error: new Error("history unavailable") }],
    ["empty", { data: { reviews: [] }, isLoading: false, error: null }],
  ])("keeps route Back active while the %s branch renders no search input", (_branch, reviewsQuery) => {
    setHistoryQuery(reviewsQuery);

    const { result } = renderHook(() => useHistoryScreen({ onOpenReview: vi.fn() }));

    expect(result.current.interactionMode).toBe("route");
  });

  it.each([
    ["error", { data: undefined, isLoading: false, error: new Error("history unavailable") }],
    ["empty", { data: { reviews: [] }, isLoading: false, error: null }],
  ])("returns to the previous route on one Escape from the %s branch", async (_branch, reviewsQuery) => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    setHistoryQuery(reviewsQuery);
    const goBack = vi.fn();
    const view = render(
      createElement(
        CliThemeProvider,
        { initialTheme: "dark" } as Parameters<typeof CliThemeProvider>[0],
        createElement(
          NavigationContext.Provider,
          {
            value: {
              route: { screen: "history" },
              navigate: vi.fn(),
              goBack,
              canGoBack: true,
            },
          },
          createElement(HistoryScreen),
        ),
      ),
    );

    view.stdin.write("\u001b");

    await vi.waitFor(() => {
      expect(goBack).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(goBack).toHaveBeenCalledTimes(1);
    expect((view.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(SUPPORT_FLOOR.rows);
  });

  it("skips run-only zones when cycling focus with no runs", () => {
    useHistoryScreenStateMock.mockReturnValue({
      reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
      reviewDetailQuery,
      reviews: [],
      timelineItems: [],
      selectedDateId: "all",
      setSelectedDateId: vi.fn(),
      searchQuery: "",
      setSearchQuery: vi.fn(),
      mappedRuns: [],
      selectedRunId: null,
      setSelectedRunId: vi.fn(),
      selectedRun: null,
      severityCounts: null,
      sortedIssues: [],
      duration: "",
      hasReviews: false,
      hasSearchQuery: false,
      emptyRunsMessage: "No runs yet",
      hasMoreReviews: false,
      isLoadingMoreReviews: false,
      loadMoreReviews: vi.fn(),
    });

    const { result } = renderHook(() => useHistoryScreen({ onOpenReview: vi.fn() }));

    expect(result.current.focusZone).toBe("search");

    act(() => {
      result.current.cycleFocusZone();
    });
    expect(result.current.focusZone).toBe("timeline");

    act(() => {
      result.current.cycleFocusZone();
    });
    expect(result.current.focusZone).toBe("search");
  });

  it("clears a zero-match search and activates its first unfiltered run in one transition", () => {
    const setSearchQuery = vi.fn();
    const setSelectedRunId = vi.fn();
    const baseState = {
      reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
      reviewDetailQuery,
      reviews: [{ id: "history-review-1" }],
      timelineItems: [],
      selectedDateId: "all",
      setSelectedDateId: vi.fn(),
      searchQuery: "no matches",
      setSearchQuery,
      mappedRuns: [],
      selectedRunId: null,
      setSelectedRunId,
      selectedRun: null,
      severityCounts: null,
      sortedIssues: [],
      duration: "",
      hasReviews: true,
      hasSearchQuery: true,
      emptyRunsMessage: "No matching runs",
      hasMoreReviews: false,
      isLoadingMoreReviews: false,
      loadMoreReviews: vi.fn(),
    };
    useHistoryScreenStateMock.mockReturnValue(baseState);
    const { result, rerender } = renderHook(() => useHistoryScreen({ onOpenReview: vi.fn() }));

    expect(result.current.focusZone).toBe("search");
    act(() => result.current.clearSearchAndFocusRuns());

    expect(setSearchQuery).toHaveBeenCalledExactlyOnceWith("");
    expect(setSelectedRunId).toHaveBeenCalledExactlyOnceWith("history-review-1");

    useHistoryScreenStateMock.mockReturnValue({
      ...baseState,
      searchQuery: "",
      mappedRuns: [
        {
          id: "history-review-1",
          displayId: "#hist",
          branch: "main",
          timestamp: "now",
          summary: "First run",
        },
      ],
      selectedRunId: "history-review-1",
      hasSearchQuery: false,
    });
    rerender();

    expect(result.current.focusZone).toBe("runs");
    expect(result.current.selectedRunId).toBe("history-review-1");
  });

  it("opens a saved review by reviewId without starting a new unstaged review", () => {
    const onOpenReview = vi.fn();
    useHistoryScreenStateMock.mockReturnValue({
      reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
      reviewDetailQuery,
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
      hasMoreReviews: false,
      isLoadingMoreReviews: false,
      loadMoreReviews: vi.fn(),
    });

    const { result } = renderHook(() => useHistoryScreen({ onOpenReview }));

    result.current.handleRunActivate("history-review-1");

    expect(onOpenReview).toHaveBeenCalledWith("history-review-1");
    expect(onOpenReview).toHaveBeenCalledTimes(1);

    result.current.handleOpenReview();

    expect(onOpenReview).toHaveBeenLastCalledWith("history-review-1");
    expect(onOpenReview).toHaveBeenCalledTimes(2);
  });
});
