import { describe, expect, it } from "vitest";
import { makeReviewMetadata } from "../../testing/factories.js";
import {
  buildHistoryRunSummary,
  buildHistoryWarningMessages,
  getRunBranchLabel,
  getRunDisplayId,
  getRunSummaryParts,
  getRunSummaryText,
  HISTORY_SEARCH_PLACEHOLDER,
  metadataToSeverityCounts,
  summarizeHistoryWarnings,
} from "../history.js";

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
    expect(
      getRunDisplayId(makeReviewMetadata({ id: "abcdef00-0000-4000-8000-000000000000" })),
    ).toBe("#abcdef00");
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

describe("HISTORY_SEARCH_PLACEHOLDER", () => {
  it("names every searchable run field in compact copy", () => {
    expect(HISTORY_SEARCH_PLACEHOLDER).toBe("Search ID, branch, path, staged...");
  });
});
