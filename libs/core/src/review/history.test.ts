import { describe, expect, it, vi } from "vitest";
import { makeIssue, makeReviewMetadata } from "../testing/factories.js";
import {
  buildHistoryRunSummary,
  buildHistoryWarningMessages,
  buildTimelineItems,
  deriveHistoryDetailState,
  filterReviewsForHistory,
  formatRunId,
  getEmptyRunsMessage,
  getRunBranchLabel,
  getRunDisplayId,
  getRunSummaryParts,
  getRunSummaryText,
  HISTORY_SEARCH_PLACEHOLDER,
  HISTORY_SECTION_ALL_ID,
  matchesHistoryQuery,
  metadataToSeverityCounts,
  resolveSelectedDateId,
  resolveSelectedId,
  sortIssuesBySeverity,
  summarizeHistoryWarnings,
} from "./history.js";

describe("deriveHistoryDetailState", () => {
  it("projects loading, error with retry, and ready query states", () => {
    const refetch = vi.fn();

    expect(deriveHistoryDetailState({ isLoading: true, error: null, refetch })).toEqual({
      status: "loading",
    });

    const errorState = deriveHistoryDetailState({
      isLoading: false,
      error: new Error("disk unreadable"),
      refetch,
    });
    expect(errorState).toMatchObject({ status: "error", message: "disk unreadable" });
    if (errorState.status === "error") errorState.retry();
    expect(refetch).toHaveBeenCalledOnce();

    expect(deriveHistoryDetailState({ isLoading: false, error: null, refetch })).toEqual({
      status: "ready",
    });
  });
});

describe("summarizeHistoryWarnings", () => {
  it("separates unreadable records, salvage loss, and index maintenance failures", () => {
    expect(
      summarizeHistoryWarnings([
        {
          kind: "unreadable_review",
          reviewId: "11111111-1111-4111-8111-111111111111",
        },
        {
          kind: "invalid_issues_dropped",
          reviewId: "22222222-2222-4222-8222-222222222222",
          count: 2,
        },
        {
          kind: "invalid_issues_dropped",
          reviewId: "33333333-3333-4333-8333-333333333333",
          count: 1,
        },
        { kind: "index_build_failed" },
        { kind: "index_rewrite_failed" },
      ]),
    ).toEqual({
      unreadableReviewCount: 1,
      droppedIssueCount: 3,
      indexBuildFailed: true,
      indexRewriteFailed: true,
    });
  });

  it("builds all warning messages with singular grammar", () => {
    expect(
      buildHistoryWarningMessages({
        unreadableReviewCount: 1,
        droppedIssueCount: 1,
        indexBuildFailed: true,
        indexRewriteFailed: true,
      }),
    ).toEqual([
      "1 saved review could not be read.",
      "1 invalid saved issue was omitted. Re-run the affected reviews for complete results.",
      "The history index could not be rebuilt. Readable reviews are still shown; reopen History to retry.",
      "The history index could not be cleaned up. Readable reviews are still shown; reopen History to retry.",
    ]);
  });

  it("builds all warning messages with plural grammar", () => {
    expect(
      buildHistoryWarningMessages({
        unreadableReviewCount: 2,
        droppedIssueCount: 3,
        indexBuildFailed: true,
        indexRewriteFailed: true,
      }),
    ).toEqual([
      "2 saved reviews could not be read.",
      "3 invalid saved issues were omitted. Re-run the affected reviews for complete results.",
      "The history index could not be rebuilt. Readable reviews are still shown; reopen History to retry.",
      "The history index could not be cleaned up. Readable reviews are still shown; reopen History to retry.",
    ]);
  });
});

function inNewYork(run: () => void): void {
  const originalTimeZone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    run();
  } finally {
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  }
}

describe("getRunSummaryParts", () => {
  it("flags a passing review when issueCount is zero", () => {
    const summary = getRunSummaryParts(makeReviewMetadata({ issueCount: 0 }));
    expect(summary.passed).toBe(true);
    expect(summary.parts).toEqual([]);
  });

  it("flags a zero-issue review as partial when any lens failed", () => {
    const summary = getRunSummaryParts(makeReviewMetadata({ issueCount: 0, failedLensCount: 1 }));

    expect(summary.passed).toBe(false);
    expect(summary.partial).toBe(true);
    expect(summary.failedLensCount).toBe(1);
  });

  it("collects only non-zero severities in canonical order", () => {
    const summary = getRunSummaryParts(
      makeReviewMetadata({
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
    expect(getRunSummaryText(makeReviewMetadata({ issueCount: 0 }))).toBe("Passed with no issues.");
  });

  it("reports partial analysis before declaring a zero-issue review passed", () => {
    expect(getRunSummaryText(makeReviewMetadata({ issueCount: 0, failedLensCount: 1 }))).toBe(
      "Partial analysis: 1 lens failed; no issues found.",
    );
  });

  it("joins severity parts with commas", () => {
    const text = getRunSummaryText(
      makeReviewMetadata({ issueCount: 3, blockerCount: 1, highCount: 2 }),
    );
    expect(text).toBe("1 blocker, 2 high");
  });

  it("falls back to a generic count when no severity breakdown is available", () => {
    expect(getRunSummaryText(makeReviewMetadata({ issueCount: 3 }))).toBe("Found 3 issues.");
    expect(getRunSummaryText(makeReviewMetadata({ issueCount: 1 }))).toBe("Found 1 issue.");
  });
});

describe("getRunBranchLabel + getRunDisplayId", () => {
  it("returns Staged when the run mode is staged", () => {
    expect(getRunBranchLabel(makeReviewMetadata({ mode: "staged" }))).toBe("Staged");
  });

  it("returns Main when the branch is missing", () => {
    expect(getRunBranchLabel(makeReviewMetadata({ mode: "unstaged", branch: undefined }))).toBe(
      "Main",
    );
  });

  it("displays a short id with a leading hash", () => {
    expect(formatRunId("abcdef00-0000-4000-8000-000000000000")).toBe("#abcdef00");
    expect(
      getRunDisplayId(makeReviewMetadata({ id: "abcdef00-0000-4000-8000-000000000000" })),
    ).toBe("#abcdef00");
  });

  it("extends colliding minimum prefixes until each loaded run is unique", () => {
    const ids = ["abcdef00-0000-4000-8000-000000000000", "abcdef00-1000-4000-8000-000000000000"];

    expect(formatRunId(ids[0] ?? "", ids)).toBe("#abcdef00-0");
    expect(formatRunId(ids[1] ?? "", ids)).toBe("#abcdef00-1");
  });
});

describe("buildHistoryRunSummary", () => {
  it("projects the id, displayId, branch, timestamp, and summary subset", () => {
    const summary = buildHistoryRunSummary(
      makeReviewMetadata({
        id: "abcdef00-0000-4000-8000-000000000000",
        mode: "staged",
        issueCount: 2,
        highCount: 2,
      }),
    );
    expect(summary.id).toBe("abcdef00-0000-4000-8000-000000000000");
    expect(summary.displayId).toBe("#abcdef00");
    expect(summary.branch).toBe("Staged");
    expect(summary.summary).toBe("2 high");
    expect(typeof summary.timestamp).toBe("string");
  });

  it("labels an unstaged run with a missing branch as Main", () => {
    const summary = buildHistoryRunSummary(
      makeReviewMetadata({ mode: "unstaged", branch: undefined, issueCount: 0 }),
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
      makeReviewMetadata({
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
      makeReviewMetadata({ id: "a", createdAt: "2026-02-09T08:00:00.000Z" }),
      makeReviewMetadata({ id: "b", createdAt: "2026-02-08T08:00:00.000Z" }),
    ];
    expect(filterReviewsForHistory(reviews, HISTORY_SECTION_ALL_ID, "")).toEqual(reviews);
  });

  it("restricts to a date section by date key", () => {
    const reviews = [
      makeReviewMetadata({ id: "a", createdAt: "2026-02-09T08:00:00.000Z" }),
      makeReviewMetadata({ id: "b", createdAt: "2026-02-08T08:00:00.000Z" }),
    ];
    const filtered = filterReviewsForHistory(reviews, "2026-02-09", "");
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });

  it("applies the search query within the selected section", () => {
    const reviews = [
      makeReviewMetadata({
        id: "a",
        branch: "feature/login",
        createdAt: "2026-02-09T08:00:00.000Z",
      }),
      makeReviewMetadata({ id: "b", branch: "main", createdAt: "2026-02-09T09:00:00.000Z" }),
    ];
    const filtered = filterReviewsForHistory(reviews, HISTORY_SECTION_ALL_ID, "feature");
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });

  it("keeps adaptive id search stable when a colliding peer is in another date section", () => {
    const reviews = [
      makeReviewMetadata({
        id: "abcdef00-0000-4000-8000-000000000000",
        createdAt: "2026-02-09T08:00:00.000Z",
      }),
      makeReviewMetadata({
        id: "abcdef00-1000-4000-8000-000000000000",
        createdAt: "2026-02-08T08:00:00.000Z",
      }),
    ];

    expect(filterReviewsForHistory(reviews, "2026-02-09", "#abcdef00-0")).toEqual([reviews[0]]);
    expect(filterReviewsForHistory(reviews, "2026-02-09", "#abcdef00-1")).toEqual([]);
  });
});

describe("matchesHistoryQuery", () => {
  it("matches by full id, short id, branch text, or project path", () => {
    const r = makeReviewMetadata({
      id: "abcdef00-0000-4000-8000-000000000000",
      branch: "feature/login",
      projectPath: "/home/user/repo",
    });

    expect(matchesHistoryQuery(r, "abcdef")).toBe(true);
    expect(matchesHistoryQuery(r, "#abcdef00")).toBe(true);
    expect(matchesHistoryQuery(r, "feature")).toBe(true);
    expect(matchesHistoryQuery(r, "repo")).toBe(true);
    expect(matchesHistoryQuery(r, "nothing")).toBe(false);
  });

  it("uses the adaptive display id to disambiguate colliding loaded runs", () => {
    const reviews = [
      makeReviewMetadata({ id: "abcdef00-0000-4000-8000-000000000000" }),
      makeReviewMetadata({ id: "abcdef00-1000-4000-8000-000000000000" }),
    ];
    const peerIds = reviews.map((review) => review.id);
    const [firstReview, secondReview] = reviews;
    if (!firstReview || !secondReview) throw new Error("Expected collision fixtures");

    expect(matchesHistoryQuery(firstReview, "#abcdef00-0", peerIds)).toBe(true);
    expect(matchesHistoryQuery(secondReview, "#abcdef00-0", peerIds)).toBe(false);
    expect(
      filterReviewsForHistory(reviews, HISTORY_SECTION_ALL_ID, secondReview.id).map(
        (review) => review.id,
      ),
    ).toEqual([secondReview.id]);
  });

  it("uses staged label when mode is staged", () => {
    const r = makeReviewMetadata({ mode: "staged" });
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
      makeReviewMetadata({ id: "a", createdAt: "2026-02-08T08:00:00.000Z" }),
      makeReviewMetadata({ id: "b", createdAt: "2026-02-09T08:00:00.000Z" }),
    ]);
    expect(items[0]?.id).toBe(HISTORY_SECTION_ALL_ID);
    expect(items[0]?.count).toBe(2);
    expect(items[1]?.count).toBe(1);
    expect(items[2]?.count).toBe(1);
  });

  it("labels date groups from the same date key used for grouping in TZ-sensitive runs", () => {
    inNewYork(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));

      try {
        const items = buildTimelineItems([
          makeReviewMetadata({ id: "a", createdAt: "2026-07-04T03:30:00.000Z" }),
          makeReviewMetadata({ id: "b", createdAt: "2026-07-04T01:30:00.000Z" }),
        ]);

        expect(items[1]).toMatchObject({ id: "2026-07-03", label: "Jul 3", count: 2 });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe("History local calendar sections", () => {
  it("groups, labels, and filters timestamps on opposite sides of local midnight", () => {
    inNewYork(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-04T16:00:00.000Z"));

      try {
        const afterMidnight = makeReviewMetadata({
          id: "after-midnight",
          createdAt: "2026-07-04T04:30:00.000Z",
        });
        const beforeMidnight = makeReviewMetadata({
          id: "before-midnight",
          createdAt: "2026-07-04T03:30:00.000Z",
        });
        const reviews = [afterMidnight, beforeMidnight];

        expect(buildTimelineItems(reviews)).toEqual([
          { id: HISTORY_SECTION_ALL_ID, label: "All", count: 2 },
          { id: "2026-07-04", label: "Today", count: 1 },
          { id: "2026-07-03", label: "Yesterday", count: 1 },
        ]);
        expect(
          filterReviewsForHistory(reviews, "2026-07-03", "").map((review) => review.id),
        ).toEqual(["before-midnight"]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("uses local DST date keys while preserving the reviews' UTC sort order", () => {
    inNewYork(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-10T16:00:00.000Z"));

      try {
        const reviews = [
          makeReviewMetadata({ id: "newest", createdAt: "2026-03-08T07:30:00.000Z" }),
          makeReviewMetadata({ id: "middle", createdAt: "2026-03-08T05:30:00.000Z" }),
          makeReviewMetadata({ id: "oldest", createdAt: "2026-03-08T04:30:00.000Z" }),
        ];

        expect(buildTimelineItems(reviews)).toEqual([
          { id: HISTORY_SECTION_ALL_ID, label: "All", count: 3 },
          { id: "2026-03-08", label: "Mar 8", count: 2 },
          { id: "2026-03-07", label: "Mar 7", count: 1 },
        ]);
        expect(
          filterReviewsForHistory(reviews, "2026-03-08", "").map((review) => review.id),
        ).toEqual(["newest", "middle"]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe("resolveSelectedDateId + resolveSelectedId", () => {
  it("returns the current date id when present, else falls back to the first", () => {
    const timeline = [{ id: HISTORY_SECTION_ALL_ID }, { id: "2026-02-09" }];
    expect(resolveSelectedDateId("2026-02-09", timeline)).toBe("2026-02-09");
    expect(resolveSelectedDateId("missing", timeline)).toBe(HISTORY_SECTION_ALL_ID);
    expect(resolveSelectedDateId("missing", [])).toBe(HISTORY_SECTION_ALL_ID);
  });

  it("returns the current run id when present, else falls back to the first", () => {
    const runs = [{ id: "run-a" }, { id: "run-b" }];
    expect(resolveSelectedId("run-b", runs)).toBe("run-b");
    expect(resolveSelectedId("missing", runs)).toBe("run-a");
    expect(resolveSelectedId("missing", [])).toBeNull();
    expect(resolveSelectedId(null, runs)).toBe("run-a");
  });
});

describe("getEmptyRunsMessage", () => {
  it("messages each empty case with distinct copy", () => {
    expect(getEmptyRunsMessage(false, false, HISTORY_SECTION_ALL_ID)).toBe("No runs yet");
    expect(getEmptyRunsMessage(true, true, HISTORY_SECTION_ALL_ID)).toBe(
      "No runs match this search",
    );
    expect(getEmptyRunsMessage(true, false, HISTORY_SECTION_ALL_ID)).toBe("No runs available");
    expect(getEmptyRunsMessage(true, false, "2026-02-09")).toBe("No runs for this date");
  });
});

describe("sortIssuesBySeverity", () => {
  it("returns an empty array for missing or empty input", () => {
    expect(sortIssuesBySeverity(undefined)).toEqual([]);
    expect(sortIssuesBySeverity([])).toEqual([]);
  });

  it("orders blocker > high > medium > low > nit without mutating the input", () => {
    const issues = [
      makeIssue({ id: "l", severity: "low", title: "low issue", line_end: 1 }),
      makeIssue({ id: "b", severity: "blocker", title: "blocker issue", line_end: 1 }),
      makeIssue({ id: "n", severity: "nit", title: "nit issue", line_end: 1 }),
      makeIssue({ id: "m", severity: "medium", title: "medium issue", line_end: 1 }),
      makeIssue({ id: "h", severity: "high", title: "high issue", line_end: 1 }),
    ];
    expect(sortIssuesBySeverity(issues).map((i) => i.severity)).toEqual([
      "blocker",
      "high",
      "medium",
      "low",
      "nit",
    ]);
    expect(issues.map((i) => i.id)).toEqual(["l", "b", "n", "m", "h"]);
  });

  it("preserves relative order within a single severity", () => {
    const issues = [
      makeIssue({ id: "h1", severity: "high", title: "high issue", line_end: 1 }),
      makeIssue({ id: "h2", severity: "high", title: "high issue", line_end: 1 }),
      makeIssue({ id: "b1", severity: "blocker", title: "blocker issue", line_end: 1 }),
      makeIssue({ id: "h3", severity: "high", title: "high issue", line_end: 1 }),
    ];
    expect(sortIssuesBySeverity(issues).map((i) => i.id)).toEqual(["b1", "h1", "h2", "h3"]);
  });
});

describe("HISTORY_SEARCH_PLACEHOLDER", () => {
  it("names every searchable run field in compact copy", () => {
    expect(HISTORY_SEARCH_PLACEHOLDER).toBe("Search ID, branch, path, staged...");
  });
});
