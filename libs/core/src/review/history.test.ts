import { describe, expect, it } from "vitest";
import type { ReviewMetadata } from "../schemas/review/index.js";
import {
  buildHistoryRunSummary,
  buildTimelineItems,
  filterReviewsForHistory,
  getEmptyRunsMessage,
  getRunBranchLabel,
  getRunDisplayId,
  getRunSummaryParts,
  getRunSummaryText,
  HISTORY_SECTION_ALL_ID,
  matchesHistoryQuery,
  metadataToSeverityCounts,
  resolveSelectedDateId,
  resolveSelectedRunId,
} from "./history.js";

function makeMetadata(overrides: Partial<ReviewMetadata> = {}): ReviewMetadata {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectPath: "/tmp/proj",
    branch: "main",
    mode: "unstaged",
    createdAt: "2026-02-09T10:30:00.000Z",
    durationMs: 4500,
    issueCount: 0,
    blockerCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    nitCount: 0,
    ...overrides,
  } as ReviewMetadata;
}

describe("getRunSummaryParts", () => {
  it("flags a passing review when issueCount is zero", () => {
    const summary = getRunSummaryParts(makeMetadata({ issueCount: 0 }));
    expect(summary.passed).toBe(true);
    expect(summary.parts).toEqual([]);
  });

  it("collects only non-zero severities in canonical order", () => {
    const summary = getRunSummaryParts(
      makeMetadata({
        issueCount: 5,
        blockerCount: 1,
        highCount: 0,
        mediumCount: 2,
        lowCount: 0,
        nitCount: 2,
      }),
    );
    expect(summary.passed).toBe(false);
    expect(summary.parts).toEqual([
      { severity: "blocker", count: 1 },
      { severity: "medium", count: 2 },
      { severity: "nit", count: 2 },
    ]);
  });
});

describe("getRunSummaryText", () => {
  it("returns the pass message when there are no issues", () => {
    expect(getRunSummaryText(makeMetadata({ issueCount: 0 }))).toBe("Passed with no issues.");
  });

  it("joins severity parts with commas", () => {
    const text = getRunSummaryText(makeMetadata({ issueCount: 3, blockerCount: 1, highCount: 2 }));
    expect(text).toBe("1 blocker, 2 high");
  });

  it("falls back to a generic count when no severity breakdown is available", () => {
    expect(getRunSummaryText(makeMetadata({ issueCount: 3 }))).toBe("Found 3 issues.");
    expect(getRunSummaryText(makeMetadata({ issueCount: 1 }))).toBe("Found 1 issue.");
  });
});

describe("getRunBranchLabel + getRunDisplayId", () => {
  it("returns Staged when the run mode is staged", () => {
    expect(getRunBranchLabel(makeMetadata({ mode: "staged" }))).toBe("Staged");
  });

  it("returns Main when the branch is missing", () => {
    expect(getRunBranchLabel(makeMetadata({ mode: "unstaged", branch: undefined }))).toBe("Main");
  });

  it("displays a short id with a leading hash", () => {
    expect(getRunDisplayId(makeMetadata({ id: "abcdef00-0000-4000-8000-000000000000" }))).toBe(
      "#abcd",
    );
  });
});

describe("buildHistoryRunSummary", () => {
  it("projects the id, displayId, branch, timestamp, and summary subset", () => {
    const summary = buildHistoryRunSummary(
      makeMetadata({
        id: "abcdef00-0000-4000-8000-000000000000",
        mode: "staged",
        issueCount: 2,
        highCount: 2,
      }),
    );
    expect(summary.id).toBe("abcdef00-0000-4000-8000-000000000000");
    expect(summary.displayId).toBe("#abcd");
    expect(summary.branch).toBe("Staged");
    expect(summary.summary).toBe("2 high");
    expect(typeof summary.timestamp).toBe("string");
  });

  it("labels an unstaged run with a missing branch as Main", () => {
    const summary = buildHistoryRunSummary(
      makeMetadata({ mode: "unstaged", branch: undefined, issueCount: 0 }),
    );
    expect(summary.branch).toBe("Main");
    expect(summary.summary).toBe("Passed with no issues.");
  });
});

describe("metadataToSeverityCounts", () => {
  it("returns null when there is no metadata", () => {
    expect(metadataToSeverityCounts(null)).toBeNull();
  });

  it("projects the five severity count fields", () => {
    const counts = metadataToSeverityCounts(
      makeMetadata({
        blockerCount: 1,
        highCount: 2,
        mediumCount: 3,
        lowCount: 4,
        nitCount: 5,
      }),
    );
    expect(counts).toEqual({ blocker: 1, high: 2, medium: 3, low: 4, nit: 5 });
  });
});

describe("filterReviewsForHistory", () => {
  it("returns all reviews when the all-section is selected and there is no query", () => {
    const reviews = [
      makeMetadata({ id: "a", createdAt: "2026-02-09T08:00:00.000Z" }),
      makeMetadata({ id: "b", createdAt: "2026-02-08T08:00:00.000Z" }),
    ];
    expect(filterReviewsForHistory(reviews, HISTORY_SECTION_ALL_ID, "")).toEqual(reviews);
  });

  it("restricts to a date section by date key", () => {
    const reviews = [
      makeMetadata({ id: "a", createdAt: "2026-02-09T08:00:00.000Z" }),
      makeMetadata({ id: "b", createdAt: "2026-02-08T08:00:00.000Z" }),
    ];
    const filtered = filterReviewsForHistory(reviews, "2026-02-09", "");
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });

  it("applies the search query within the selected section", () => {
    const reviews = [
      makeMetadata({ id: "a", branch: "feature/login", createdAt: "2026-02-09T08:00:00.000Z" }),
      makeMetadata({ id: "b", branch: "main", createdAt: "2026-02-09T09:00:00.000Z" }),
    ];
    const filtered = filterReviewsForHistory(reviews, HISTORY_SECTION_ALL_ID, "feature");
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("matchesHistoryQuery", () => {
  it("matches by full id, short id, branch text, or project path", () => {
    const r = makeMetadata({
      id: "abcdef00-0000-4000-8000-000000000000",
      branch: "feature/login",
      projectPath: "/home/user/repo",
    });

    expect(matchesHistoryQuery(r, "abcdef")).toBe(true);
    expect(matchesHistoryQuery(r, "#abcd")).toBe(true);
    expect(matchesHistoryQuery(r, "feature")).toBe(true);
    expect(matchesHistoryQuery(r, "repo")).toBe(true);
    expect(matchesHistoryQuery(r, "nothing")).toBe(false);
  });

  it("uses staged label when mode is staged", () => {
    const r = makeMetadata({ mode: "staged" });
    expect(matchesHistoryQuery(r, "staged")).toBe(true);
  });
});

describe("buildTimelineItems", () => {
  it("returns only the all-section when there are no reviews", () => {
    const items = buildTimelineItems([]);
    expect(items).toEqual([{ id: HISTORY_SECTION_ALL_ID, label: "All", count: 0 }]);
  });

  it("prepends the all-section followed by date sections in descending order", () => {
    const items = buildTimelineItems([
      makeMetadata({ id: "a", createdAt: "2026-02-08T08:00:00.000Z" }),
      makeMetadata({ id: "b", createdAt: "2026-02-09T08:00:00.000Z" }),
    ]);
    expect(items[0]?.id).toBe(HISTORY_SECTION_ALL_ID);
    expect(items[0]?.count).toBe(2);
    expect(items[1]?.count).toBe(1);
    expect(items[2]?.count).toBe(1);
  });
});

describe("resolveSelectedDateId + resolveSelectedRunId", () => {
  it("returns the current date id when present, else falls back to the first", () => {
    const timeline = [{ id: HISTORY_SECTION_ALL_ID }, { id: "2026-02-09" }];
    expect(resolveSelectedDateId("2026-02-09", timeline)).toBe("2026-02-09");
    expect(resolveSelectedDateId("missing", timeline)).toBe(HISTORY_SECTION_ALL_ID);
    expect(resolveSelectedDateId("missing", [])).toBe(HISTORY_SECTION_ALL_ID);
  });

  it("returns the current run id when present, else falls back to the first", () => {
    const runs = [{ id: "run-a" }, { id: "run-b" }];
    expect(resolveSelectedRunId("run-b", runs)).toBe("run-b");
    expect(resolveSelectedRunId("missing", runs)).toBe("run-a");
    expect(resolveSelectedRunId("missing", [])).toBeNull();
    expect(resolveSelectedRunId(null, runs)).toBe("run-a");
  });
});

describe("getEmptyRunsMessage", () => {
  it("messages each empty case with distinct copy", () => {
    expect(getEmptyRunsMessage(false, false, HISTORY_SECTION_ALL_ID)).toBe("No reviews yet");
    expect(getEmptyRunsMessage(true, true, HISTORY_SECTION_ALL_ID)).toBe(
      "No runs match this search",
    );
    expect(getEmptyRunsMessage(true, false, HISTORY_SECTION_ALL_ID)).toBe("No runs available");
    expect(getEmptyRunsMessage(true, false, "2026-02-09")).toBe("No runs for this date");
  });
});
