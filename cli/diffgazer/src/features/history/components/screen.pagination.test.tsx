import { createDeferred } from "@diffgazer/core/testing/deferred";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavigationContext } from "../../../hooks/use-navigation";
import { buildResponsiveResult, getBreakpointTier } from "../../../lib/breakpoints";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { CliThemeProvider } from "../../../theme/provider";
import { HistoryScreen } from "./screen";

const useHistoryScreenStateMock = vi.hoisted(() => vi.fn());
const terminalSize = vi.hoisted(() => ({ columns: 100, rows: 30 }));
const SUPPORT_FLOOR = { columns: 80, rows: 24 } as const;

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useInit: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@diffgazer/core/review", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/review")>();
  return { ...actual, useHistoryScreenState: useHistoryScreenStateMock };
});

vi.mock("@diffgazer/core/footer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/footer")>()),
  usePageFooter: vi.fn(),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    ...buildResponsiveResult(getBreakpointTier(terminalSize.columns)),
  }),
  useTerminalDimensions: () => terminalSize,
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

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.clearAllMocks();
  terminalSize.columns = 100;
  terminalSize.rows = 30;
});

function renderHistoryScreen() {
  return render(
    <CliThemeProvider initialTheme="dark">
      <NavigationContext.Provider
        value={{
          route: { screen: "history" },
          navigate: vi.fn(),
          goBack: vi.fn(),
          canGoBack: true,
        }}
      >
        <HistoryScreen />
      </NavigationContext.Provider>
    </CliThemeProvider>,
  );
}

describe("HistoryScreen pagination", () => {
  it("loads past an empty cursor page and suppresses duplicate requests in flight", async () => {
    const releasePage = createDeferred<void>();
    const loadMoreCalls = vi.fn();

    function useEmptyThenLaterHistoryPage() {
      const [pageState, setPageState] = useState<"empty" | "loading" | "loaded">("empty");
      const loaded = pageState === "loaded";
      const loading = pageState === "loading";

      return {
        reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
        reviewDetailQuery: {
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        },
        reviews: [],
        timelineItems: [],
        selectedDateId: "all",
        setSelectedDateId: vi.fn(),
        searchQuery: "",
        setSearchQuery: vi.fn(),
        mappedRuns: loaded
          ? [
              {
                id: "later-review",
                displayId: "#late",
                branch: "main",
                timestamp: "now",
                summary: "Review from a later page",
              },
            ]
          : [],
        selectedRunId: loaded ? "later-review" : null,
        setSelectedRunId: vi.fn(),
        selectedRun: null,
        severityCounts: null,
        sortedIssues: [],
        duration: "",
        hasReviews: loaded,
        hasSearchQuery: false,
        emptyRunsMessage: "No runs yet",
        hasMoreReviews: !loaded,
        isLoadingMoreReviews: loading,
        loadMoreReviews: async () => {
          loadMoreCalls();
          setPageState("loading");
          await releasePage.promise;
          setPageState("loaded");
        },
      };
    }

    useHistoryScreenStateMock.mockImplementation(useEmptyThenLaterHistoryPage);
    const view = renderHistoryScreen();

    expect(view.lastFrame()).toContain("Load older runs");
    expect(view.lastFrame()).not.toContain("Review from a later page");

    view.stdin.write("l");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("Loading older runs"));
    view.stdin.write("l");
    await new Promise((resolve) => setImmediate(resolve));
    expect(loadMoreCalls).toHaveBeenCalledTimes(1);

    releasePage.resolve();
    await vi.waitFor(() => expect(view.lastFrame()).toContain("Review from a later page"));
    expect(view.lastFrame()).not.toContain("Load older runs");
  });

  it("keeps the pagination affordance and long run content inside an 80x24 frame", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    const runs = Array.from({ length: 1 }, (_, index) => ({
      id: `review-${index + 1}`,
      displayId: `#review-${index + 1}`,
      branch: `feature/history-pagination-${index + 1}-with-a-long-branch-name`,
      timestamp: "07/18/2026, 10:33:48 PM",
      summary: `Historical review ${index + 1} with a long summary`,
    }));
    useHistoryScreenStateMock.mockReturnValue({
      reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
      reviewDetailQuery: {
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      },
      reviews: [],
      timelineItems: [],
      selectedDateId: "all",
      setSelectedDateId: vi.fn(),
      searchQuery: "",
      setSearchQuery: vi.fn(),
      mappedRuns: runs,
      selectedRunId: runs[0]?.id ?? null,
      setSelectedRunId: vi.fn(),
      selectedRun: null,
      severityCounts: null,
      sortedIssues: [],
      duration: "",
      hasReviews: true,
      hasSearchQuery: false,
      emptyRunsMessage: "No runs yet",
      hasMoreReviews: true,
      isLoadingMoreReviews: false,
      loadMoreReviews: vi.fn(async () => {}),
    });

    const { lastFrame } = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() => expect(lastFrame()).toContain("Load older runs"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Historical review 1");
    expect(frame.split("\n")).toHaveLength(24);
  });
});
