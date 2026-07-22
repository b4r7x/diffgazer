import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationContext } from "../../../hooks/use-navigation";
import { buildResponsiveResult, getBreakpointTier } from "../../../lib/breakpoints";
import { flush } from "../../../testing/flush";
import { CliThemeProvider } from "../../../theme/provider";
import { HistoryScreen } from "./screen";

const useHistoryScreenStateMock = vi.hoisted(() => vi.fn());
const terminalSize = vi.hoisted(() => ({ columns: 100, rows: 30 }));
const SUPPORT_FLOOR = { columns: 80, rows: 24 } as const;

vi.mock("@diffgazer/core/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/review")>()),
  useHistoryScreenState: useHistoryScreenStateMock,
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    ...buildResponsiveResult(getBreakpointTier(terminalSize.columns)),
  }),
  useTerminalDimensions: () => terminalSize,
}));

vi.mock("../../../components/layout/global", () => ({
  useContentZone: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    contentColumns: terminalSize.columns,
    contentRows: terminalSize.rows - 4,
  }),
}));

function FooterProbe() {
  const { shortcuts, rightShortcuts } = useFooterData();
  const left = shortcuts.map(({ key, label }) => `${key} ${label}`).join(" | ");
  const right = rightShortcuts.map(({ key, label }) => `${key} ${label}`).join(" | ");
  return <Text>{`Footer left: ${left || "none"} right: ${right || "none"}`}</Text>;
}

function renderHistoryScreenWithFooter() {
  return render(
    <FooterProvider initialShortcuts={[]}>
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
          <FooterProbe />
        </NavigationContext.Provider>
      </CliThemeProvider>
    </FooterProvider>,
  );
}

function setHistoryQuery(reviewsQuery: {
  data?: { reviews: never[] };
  isLoading: boolean;
  error: Error | null;
}) {
  useHistoryScreenStateMock.mockReturnValue({
    reviewsQuery,
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

beforeEach(() => {
  terminalSize.columns = 100;
  terminalSize.rows = 30;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HistoryScreen footer", () => {
  test.each([
    ["loading", { data: undefined, isLoading: true, error: null }],
    ["error", { data: undefined, isLoading: false, error: new Error("history unavailable") }],
    ["empty", { data: { reviews: [] }, isLoading: false, error: null }],
  ])("keeps route Back active while the %s branch renders no search input", async (_branch, reviewsQuery) => {
    setHistoryQuery(reviewsQuery);

    const view = renderHistoryScreenWithFooter();
    await flush();

    expect(view.lastFrame()).toContain("Footer left: none right: Esc Back");
  });

  test("keeps Tab in Search and the footer visible at the 80x24 support floor", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    const setSearchQuery = vi.fn();
    const setSelectedDateId = vi.fn();
    useHistoryScreenStateMock.mockReturnValue({
      reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
      reviewDetailQuery: {
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      },
      reviews: [],
      timelineItems: [
        { id: "all", label: "All", count: 1 },
        { id: "today", label: "Today", count: 1 },
      ],
      selectedDateId: "all",
      setSelectedDateId,
      searchQuery: "",
      setSearchQuery,
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
    const view = renderHistoryScreenWithFooter();
    expect(view.lastFrame()).toContain("RUNS");
    expect((view.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(SUPPORT_FLOOR.rows);

    view.stdin.write("/");
    await flush();
    expect(view.lastFrame()).toContain("Footer left: ↓ Timeline right: Esc Clear Search");

    view.stdin.write("\t");
    await flush();
    view.stdin.write("x");
    await flush();

    expect(setSearchQuery).toHaveBeenCalledExactlyOnceWith("x");

    view.stdin.write("\u001B[B");
    await flush();
    view.stdin.write("\u001B[B");
    await flush();
    view.stdin.write("y");
    await flush();

    expect(setSelectedDateId).toHaveBeenCalledExactlyOnceWith("today");
    expect(setSearchQuery).toHaveBeenCalledExactlyOnceWith("x");
  });
});
