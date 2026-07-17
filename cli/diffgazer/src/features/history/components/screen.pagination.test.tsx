import { createDeferred } from "@diffgazer/core/testing/deferred";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavigationContext } from "../../../hooks/use-navigation";
import { CliThemeProvider } from "../../../theme/provider";
import { HistoryScreen } from "./screen";

const useHistoryScreenStateMock = vi.hoisted(() => vi.fn());

vi.mock("@diffgazer/core/review", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/review")>();
  return { ...actual, useHistoryScreenState: useHistoryScreenStateMock };
});

vi.mock("@diffgazer/core/footer", () => ({
  usePageFooter: vi.fn(),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    columns: 100,
    rows: 30,
    isNarrow: false,
    isMedium: false,
  }),
  useTerminalDimensions: () => ({ columns: 100, rows: 30 }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
});
