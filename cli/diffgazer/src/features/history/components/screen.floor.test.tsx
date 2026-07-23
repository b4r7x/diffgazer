import { canonicalReviewFixture } from "@diffgazer/core/testing/review-facts";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { HistoryScreen } from "./screen";

const f = canonicalReviewFixture;

const mappedRuns = [
  {
    id: f.metadata.id,
    displayId: "#c0ffee",
    branch: "feature/mobile-tui-parity",
    timestamp: "Jul 18, 10:33",
    summary: "8 issues · 1 blocker",
  },
  {
    id: "b1b1b1b1-2222-4333-8444-555566667777",
    displayId: "#b1b1b1",
    branch: "main",
    timestamp: "Jul 17, 09:00",
    summary: "3 issues",
  },
];

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useInit: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@diffgazer/core/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/review")>()),
  useHistoryScreenState: () => ({
    reviewsQuery: {
      data: { reviews: [f.metadata], warnings: [] },
      isLoading: false,
      error: null,
    },
    reviewDetailQuery: { isLoading: false, isError: false, error: null, refetch: vi.fn() },
    reviews: [f.metadata],
    timelineItems: [
      { id: "all", label: "All", count: 2 },
      { id: "2026-07-18", label: "Jul 18", count: 1 },
      { id: "2026-07-17", label: "Jul 17", count: 1 },
    ],
    selectedDateId: "all",
    setSelectedDateId: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    mappedRuns,
    selectedRunId: f.metadata.id,
    setSelectedRunId: vi.fn(),
    selectedRun: f.metadata,
    severityCounts: { blocker: 1, high: 2, medium: 2, low: 2, nit: 1 },
    sortedIssues: f.result.issues,
    duration: "42.7s",
    hasReviews: true,
    emptyRunsMessage: "No runs yet",
    hasMoreReviews: false,
    isLoadingMoreReviews: false,
    loadMoreReviews: vi.fn(),
  }),
}));

afterEach(() => {
  cleanupRootFrames();
  vi.clearAllMocks();
});

function hasEmptyBoxPair(frame: string): boolean {
  const lines = frame.split("\n");
  for (let index = 0; index < lines.length - 1; index += 1) {
    const top = lines[index];
    const bottom = lines[index + 1];
    if (top && bottom && /┌─+┐/.test(top) && /└─+┘/.test(bottom)) return true;
  }
  return false;
}

describe("HistoryScreen floor", () => {
  test("degrades to a single populated pane at the 60x20 floor", async () => {
    const { lastFrame } = renderRootFrame(60, 20, <HistoryScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("RUNS"));
    const frame = stripAnsi(lastFrame() ?? "");

    expect(frame.split("\n")).toHaveLength(20);
    // The focused pane keeps its header and at least one run row instead of
    // collapsing every pane into an empty bordered box.
    expect(frame).toMatch(/SECTIONS|RUNS|INSIGHTS/);
    expect(frame).toContain("#c0ffee");
    expect(hasEmptyBoxPair(frame)).toBe(false);
  });

  test("keeps all three history panes populated at the 80x24 floor", async () => {
    const { lastFrame } = renderRootFrame(80, 24, <HistoryScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("RUNS"));
    const frame = stripAnsi(lastFrame() ?? "");

    expect(frame.split("\n")).toHaveLength(24);
    expect(frame).toContain("SECTIONS");
    expect(frame).toContain("INSIGHTS");
    // One content row per pane: a timeline section, a run, and an insights issue row.
    expect(frame).toContain("Jul 18");
    expect(frame).toContain("#c0ffee");
    expect(frame).toContain("ISSUES");
  });
});
