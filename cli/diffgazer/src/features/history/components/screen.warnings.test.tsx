import type { ReviewListWarning } from "@diffgazer/core/schemas/review";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavigationContext } from "../../../hooks/use-navigation";
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
    isNarrow: terminalSize.columns < 80,
    isMedium: terminalSize.columns >= 80 && terminalSize.columns < 120,
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

function makeHistoryState({
  hasReviews,
  warnings,
}: {
  hasReviews: boolean;
  warnings: ReviewListWarning[];
}) {
  const review = {
    id: "readable-review",
    displayId: "#read",
    branch: "main",
    timestamp: "now",
    summary: "Readable review",
  };

  return {
    reviewsQuery: {
      data: {
        reviews: hasReviews ? [review] : [],
        warnings,
      },
      isLoading: false,
      error: null,
    },
    reviewDetailQuery: { isLoading: false, isError: false, error: null, refetch: vi.fn() },
    reviews: [],
    timelineItems: [],
    selectedDateId: "all",
    setSelectedDateId: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    mappedRuns: hasReviews ? [review] : [],
    selectedRunId: hasReviews ? review.id : null,
    setSelectedRunId: vi.fn(),
    selectedRun: null,
    severityCounts: null,
    sortedIssues: [],
    duration: "",
    hasReviews,
    hasSearchQuery: false,
    emptyRunsMessage: "No runs yet",
    hasMoreReviews: false,
    isLoadingMoreReviews: false,
    loadMoreReviews: vi.fn(async () => {}),
  };
}

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

describe("HistoryScreen unreadable review warnings", () => {
  it("shows the warning before a partial history list", () => {
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryState({
        hasReviews: true,
        warnings: [
          {
            kind: "unreadable_review",
            reviewId: "11111111-1111-4111-8111-111111111111",
          },
          {
            kind: "unreadable_review",
            reviewId: "22222222-2222-4222-8222-222222222222",
          },
        ],
      }),
    );

    const frame = renderHistoryScreen().lastFrame();

    expect(frame).toContain("2 saved reviews could not be read.");
    expect(frame).toContain("Readable review");
  });

  it("shows the warning when every saved review is unreadable", () => {
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryState({
        hasReviews: false,
        warnings: [
          {
            kind: "unreadable_review",
            reviewId: "11111111-1111-4111-8111-111111111111",
          },
        ],
      }),
    );

    const frame = renderHistoryScreen().lastFrame();

    expect(frame).toContain("1 saved review could not be read.");
    expect(frame).toContain("No runs yet");
  });

  it("renders maintenance and salvage warnings without reporting missing reviews", () => {
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryState({
        hasReviews: true,
        warnings: [
          { kind: "index_build_failed" },
          { kind: "index_rewrite_failed" },
          {
            kind: "invalid_issues_dropped",
            reviewId: "11111111-1111-4111-8111-111111111111",
            count: 2,
          },
        ],
      }),
    );

    const frame = renderHistoryScreen().lastFrame();

    expect(frame).toContain("2 invalid saved issues were omitted.");
    expect(frame).toContain("history index could not be rebuilt");
    expect(frame).toContain("history index could not be cleaned up");
    expect(frame).not.toContain("saved review could not be read");
    expect(frame).not.toContain("saved reviews could not be read");
  });

  it("keeps warning chrome and run content inside an 80 by 24 root frame", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryState({
        hasReviews: true,
        warnings: [
          {
            kind: "unreadable_review",
            reviewId: "11111111-1111-4111-8111-111111111111",
          },
        ],
      }),
    );

    const { lastFrame } = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() => expect(lastFrame()).toContain("1 saved review could not be read."));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Readable review");
    expect(frame.split("\n")).toHaveLength(24);
  });
});
