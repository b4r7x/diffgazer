import { buildRunIdLookup } from "@diffgazer/core/format";
import type { ReviewListWarning } from "@diffgazer/core/schemas/review";
import { makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavigationContext } from "../../../hooks/use-navigation";
import { buildResponsiveResult, getBreakpointTier } from "../../../lib/breakpoints";
import { flush } from "../../../testing/flush";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { CliThemeProvider } from "../../../theme/provider";
import { makeHistoryScreenState } from "../testing/screen-state";
import { HistoryScreen } from "./screen";

const useHistoryScreenStateMock = vi.hoisted(() => vi.fn());
const terminalSize = vi.hoisted(() => ({ columns: 100, rows: 30 }));
const SUPPORT_FLOOR = { columns: 80, rows: 24 } as const;

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useConfigurationInit: () => ({ data: undefined, isLoading: false }),
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

  return makeHistoryScreenState({
    reviewsQuery: {
      data: {
        reviews: hasReviews ? [review] : [],
        warnings,
      },
      isLoading: false,
      error: null,
    },
    mappedRuns: hasReviews ? [review] : [],
    selectedRunId: hasReviews ? review.id : null,
    hasReviews,
    loadMoreReviews: vi.fn(async () => {}),
  });
}

const HIGH_CARDINALITY_WARNING_KINDS = ["unreadable", "salvage", "mixed"] as const;
type HighCardinalityWarningKind = (typeof HIGH_CARDINALITY_WARNING_KINDS)[number];

function makeHighCardinalityWarnings(kind: HighCardinalityWarningKind): ReviewListWarning[] {
  const ids = Array.from(
    { length: 50 },
    (_, index) => `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
  );
  const unreadableWarnings: ReviewListWarning[] = ids.map((reviewId) => ({
    kind: "unreadable_review",
    reviewId,
  }));
  const salvageWarnings: ReviewListWarning[] = ids.map((reviewId) => ({
    kind: "invalid_issues_dropped",
    reviewId,
    count: 1,
  }));

  if (kind === "unreadable") return unreadableWarnings;
  if (kind === "salvage") return salvageWarnings;
  return unreadableWarnings.flatMap((warning, index) => {
    const salvageWarning = salvageWarnings[index];
    return salvageWarning ? [warning, salvageWarning] : [warning];
  });
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

    const frame = renderHistoryScreen().lastFrame() ?? "";

    expect(frame).toContain("2 saved reviews (");
    expect(frame).toContain("Readable review");

    const warningIndex = frame.indexOf("2 saved reviews (");
    const runLabelIndex = frame.indexOf("Readable review");
    expect(warningIndex).toBeGreaterThanOrEqual(0);
    expect(runLabelIndex).toBeGreaterThanOrEqual(0);
    expect(warningIndex).toBeLessThan(runLabelIndex);
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

    expect(frame).toContain("1 saved review (");
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

    expect(frame).toContain("2 invalid saved issues were omitted from");
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
    await vi.waitFor(() => expect(lastFrame()).toContain("1 saved review ("));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Readable review");
    expect(frame.split("\n")).toHaveLength(24);
  });

  it.each([
    20, 50,
  ])("bounds %d warning targets without displacing the history pane", async (count) => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    const warnings: ReviewListWarning[] = Array.from({ length: count }, (_, index) => ({
      kind: "unreadable_review",
      reviewId: `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    }));
    useHistoryScreenStateMock.mockReturnValue(makeHistoryState({ hasReviews: true, warnings }));

    const { lastFrame } = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() => expect(lastFrame()).toContain(`… +${count - 3} more`));

    const frame = lastFrame() ?? "";
    expect(frame).toContain("#00000000");
    expect(frame).toContain("Readable review");
    expect(frame.split("\n")).toHaveLength(24);
  });

  it("opens a bounded warning-target detail view for IDs beyond the sample", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    const warnings: ReviewListWarning[] = Array.from({ length: 50 }, (_, index) => ({
      kind: "unreadable_review",
      reviewId: `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    }));
    useHistoryScreenStateMock.mockReturnValue(makeHistoryState({ hasReviews: true, warnings }));

    const view = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() =>
      expect(view.lastFrame()).toContain("Press w to view all affected run IDs."),
    );

    view.stdin.write("w");
    await flush();
    expect(view.lastFrame()).toContain("All affected run IDs");
    expect(view.lastFrame()).not.toContain("00000013-1111-4111-8111-111111111111");

    view.stdin.write("\u001b[F");
    await flush();
    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("00000031-1111-4111-8111-111111111111");
    expect(frame.split("\n")).toHaveLength(24);
  });

  it("opens all-unreadable warning detail even when no run pane is available", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    const warnings: ReviewListWarning[] = [
      {
        kind: "unreadable_review",
        reviewId: "11111111-1111-4111-8111-111111111111",
      },
    ];
    useHistoryScreenStateMock.mockReturnValue(makeHistoryState({ hasReviews: false, warnings }));

    const view = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() =>
      expect(view.lastFrame()).toContain("Press w to view all affected run IDs."),
    );

    view.stdin.write("w");
    await flush();

    expect(view.lastFrame()).toContain("All affected run IDs");
    expect(view.lastFrame()).toContain("11111111-1111-4111-8111-111111111111");
  });

  it("does not open an empty detail view for maintenance-only warnings", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryState({ hasReviews: true, warnings: [{ kind: "index_build_failed" }] }),
    );

    const view = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() =>
      expect(view.lastFrame()).toContain("history index could not be rebuilt"),
    );

    view.stdin.write("w");
    await flush();

    expect(view.lastFrame()).not.toContain("All affected run IDs");
    expect(view.lastFrame()).not.toContain("Press w or Esc to hide IDs.");
  });

  it.each(
    HIGH_CARDINALITY_WARNING_KINDS,
  )("keeps the %s warning title, hint, and readable run in the 80 by 24 detail view", async (kind) => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryState({
        hasReviews: true,
        warnings: makeHighCardinalityWarnings(kind),
      }),
    );

    const view = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() =>
      expect(view.lastFrame()).toContain("Press w to view all affected run IDs."),
    );

    view.stdin.write("w");
    await flush();

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("History warning");
    expect(frame).toContain("All affected run IDs");
    expect(frame).toContain("Press w or Esc to hide IDs.");
    expect(frame).toContain("Readable review");
    expect(frame.split("\n")).toHaveLength(24);

    view.stdin.write("\u001b[F");
    await flush();
    expect(view.lastFrame()).toContain("00000031-1111-4111-8111-111111111111");
  });

  it("keeps a colliding salvaged run visible at the 80 by 24 mixed-warning floor", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    const visibleSalvagedId = "abcdef00-0000-4000-8000-000000000000";
    const warningOnlyColliderId = "abcdef00-0000-4000-8000-000000000001";
    const mixedIds = Array.from(
      { length: 48 },
      (_, index) => `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    );
    const mixedWarnings = mixedIds.flatMap<ReviewListWarning>((reviewId) => [
      { kind: "unreadable_review", reviewId },
      { kind: "invalid_issues_dropped", reviewId, count: 1 },
    ]);
    const warnings: ReviewListWarning[] = [
      { kind: "invalid_issues_dropped", reviewId: visibleSalvagedId, count: 1 },
      { kind: "unreadable_review", reviewId: warningOnlyColliderId },
      ...mixedWarnings,
    ];
    const runIdLookup = buildRunIdLookup([visibleSalvagedId, warningOnlyColliderId, ...mixedIds]);
    const visibleRun = {
      id: visibleSalvagedId,
      displayId: runIdLookup.get(visibleSalvagedId) ?? visibleSalvagedId,
      branch: "main",
      timestamp: "now",
      summary: "Affected run",
    };
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryScreenState({
        reviewsQuery: {
          data: { reviews: [{ id: visibleSalvagedId }], warnings },
          isLoading: false,
          error: null,
        },
        reviews: [{ id: visibleSalvagedId }],
        runIdLookup,
        mappedRuns: [visibleRun],
        selectedRunId: visibleSalvagedId,
        hasReviews: true,
      }),
    );

    const view = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() =>
      expect(view.lastFrame()).toContain("Press w to view all affected run IDs."),
    );

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("RUNS");
    expect(frame).toContain(runIdLookup.get(visibleSalvagedId) ?? visibleSalvagedId);
    expect(frame).toContain("[Salvaged]");
    expect(frame).toContain("Re-run the affected reviews for complete results.");
    expect(frame).toContain("Press w to view all affected run IDs.");
    expect(frame.split("\n")).toHaveLength(24);

    view.stdin.write("w");
    await flush();

    const detailFrame = view.lastFrame() ?? "";
    expect(detailFrame).toContain("History warning · All affected run IDs");
    expect(detailFrame).toContain(visibleSalvagedId);
    expect(detailFrame).toContain("[Salvaged]");
    expect(detailFrame).toContain("Search ID, branch, path, staged");
    expect(detailFrame).toContain("Press w or Esc to hide IDs.");
    expect(detailFrame.split("\n")).toHaveLength(24);
  });

  it("keeps run selection inactive while warning detail owns navigation keys", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    const setSelectedRunId = vi.fn();
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryScreenState({
        reviewsQuery: {
          data: {
            reviews: [{ id: "readable-review" }],
            warnings: makeHighCardinalityWarnings("mixed"),
          },
          isLoading: false,
          error: null,
        },
        mappedRuns: [
          {
            id: "readable-review",
            displayId: "#read",
            branch: "main",
            timestamp: "now",
            summary: "Readable review",
          },
        ],
        selectedRunId: "readable-review",
        setSelectedRunId,
        hasReviews: true,
      }),
    );

    const view = renderRootFrame(80, 24, <HistoryScreen />);
    await vi.waitFor(() =>
      expect(view.lastFrame()).toContain("Press w to view all affected run IDs."),
    );

    view.stdin.write("w");
    await flush();
    setSelectedRunId.mockClear();

    for (const input of ["\u001B[B", "\u001B[6~", "\u001B[H", "\u001B[F"]) {
      view.stdin.write(input);
      await flush();
    }

    expect(setSelectedRunId).not.toHaveBeenCalled();

    view.stdin.write("\u001b");
    await flush();
    await vi.waitFor(() =>
      expect(view.lastFrame()).toContain("Press w to view all affected run IDs."),
    );
  });

  it("marks only the affected run when two runs are listed", () => {
    const affectedId = "11111111-1111-4111-8111-111111111111";
    const unaffectedId = "22222222-2222-4222-8222-222222222222";
    const runs = [
      {
        id: affectedId,
        displayId: "#11111111",
        branch: "main",
        timestamp: "now",
        summary: "Affected run",
      },
      {
        id: unaffectedId,
        displayId: "#22222222",
        branch: "main",
        timestamp: "earlier",
        summary: "Unaffected run",
      },
    ];
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryScreenState({
        reviewsQuery: {
          data: {
            reviews: [{ id: affectedId }, { id: unaffectedId }],
            warnings: [{ kind: "invalid_issues_dropped", reviewId: affectedId, count: 1 }],
          },
          isLoading: false,
          error: null,
        },
        reviews: [{ id: affectedId }, { id: unaffectedId }],
        mappedRuns: runs,
        selectedRunId: affectedId,
        hasReviews: true,
      }),
    );

    const frame = renderHistoryScreen().lastFrame() ?? "";
    const affectedLine = frame.split("\n").find((line) => line.includes("Affected run"));
    const unaffectedLine = frame.split("\n").find((line) => line.includes("Unaffected run"));

    if (!affectedLine || !unaffectedLine) throw new Error("Expected both history runs");
    expect(affectedLine).toContain("[Salvaged]");
    expect(unaffectedLine).not.toContain("[Salvaged]");
  });

  it("shares warning-only collisions with the row and selected insights label", () => {
    const unreadableId = "abcdef00-0000-4000-8000-000000000000";
    const affectedId = "abcdef00-1000-4000-8000-000000000000";
    const unaffectedId = "fedcba99-2000-4000-8000-000000000000";
    const runs = [
      {
        id: affectedId,
        displayId: "#abcdef00-1",
        branch: "main",
        timestamp: "now",
        summary: "Affected run",
      },
      {
        id: unaffectedId,
        displayId: "#fedcba99",
        branch: "main",
        timestamp: "earlier",
        summary: "Unaffected run",
      },
    ];
    useHistoryScreenStateMock.mockReturnValue(
      makeHistoryScreenState({
        reviewsQuery: {
          data: {
            reviews: [{ id: affectedId }, { id: unaffectedId }],
            warnings: [
              { kind: "unreadable_review", reviewId: unreadableId },
              { kind: "invalid_issues_dropped", reviewId: affectedId, count: 1 },
            ],
          },
          isLoading: false,
          error: null,
        },
        reviews: [{ id: affectedId }, { id: unaffectedId }],
        mappedRuns: runs,
        selectedRunId: affectedId,
        selectedRun: makeReviewMetadata({ id: affectedId }),
        hasReviews: true,
      }),
    );

    const frame = renderHistoryScreen().lastFrame() ?? "";
    const affectedLine = frame.split("\n").find((line) => line.includes("Affected run"));
    const unaffectedLine = frame.split("\n").find((line) => line.includes("Unaffected run"));

    if (!affectedLine || !unaffectedLine) throw new Error("Expected both history runs");
    expect(frame).toContain("1 saved review (#abcdef00-0) could not be read.");
    expect(frame).toContain("1 invalid saved issue was omitted from #abcdef00-1.");
    expect(frame).toContain("#abcdef00-1");
    expect(affectedLine).toContain("[Salvaged]");
    expect(unaffectedLine).not.toContain("[Salvaged]");
    expect(frame).toContain("INSIGHTS: RUN #ABCDEF00-1");
  });
});
