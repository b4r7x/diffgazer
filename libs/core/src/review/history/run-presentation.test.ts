import { describe, expect, it } from "vitest";
import { DETACHED_HEAD_BRANCH } from "../../schemas/git.js";
import { makeReviewMetadata } from "../../testing/factories.js";
import {
  buildHistoryRunSummary,
  getRunBranchLabel,
  getRunSummaryParts,
  getRunSummaryText,
  metadataToSeverityCounts,
  resolveRunDisplayId,
} from "./run-presentation.js";

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

  it("does not mark a non-completed terminal outcome as passed", () => {
    const summary = getRunSummaryParts(
      makeReviewMetadata({ issueCount: 0, terminalOutcome: "timed-out" }),
    );

    expect(summary.passed).toBe(false);
    expect(summary.partial).toBe(false);
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

  it("reports the findings a partial analysis did produce", () => {
    expect(getRunSummaryText(makeReviewMetadata({ issueCount: 3, failedLensCount: 1 }))).toBe(
      "Partial analysis: 1 lens failed; 3 issues found.",
    );
  });

  it("reports a non-completed terminal outcome instead of a pass", () => {
    expect(
      getRunSummaryText(makeReviewMetadata({ issueCount: 0, terminalOutcome: "cancelled" })),
    ).toBe("Review ended with outcome cancelled.");
  });

  it("says how far a terminal run got when some lenses reported", () => {
    expect(
      getRunSummaryText(
        makeReviewMetadata({
          issueCount: 0,
          terminalOutcome: "budget-exhausted",
          failedLensCount: 3,
          lenses: ["correctness", "security", "performance", "simplicity", "tests"],
        }),
      ),
    ).toBe("Budget Exhausted · 2 of 5 lenses completed · 0 issues");
  });

  it("counts the findings a terminal run kept in the same sentence", () => {
    expect(
      getRunSummaryText(
        makeReviewMetadata({
          issueCount: 2,
          highCount: 2,
          terminalOutcome: "budget-exhausted",
          failedLensCount: 3,
          lenses: ["correctness", "security", "performance", "simplicity", "tests"],
        }),
      ),
    ).toBe("Budget Exhausted · 2 of 5 lenses completed · 2 issues");
  });

  it("keeps the bare outcome when no lens reported", () => {
    expect(
      getRunSummaryText(
        makeReviewMetadata({
          issueCount: 0,
          terminalOutcome: "budget-exhausted",
          failedLensCount: 2,
          lenses: ["correctness", "security"],
        }),
      ),
    ).toBe("Review ended with outcome budget-exhausted.");
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

describe("getRunBranchLabel", () => {
  it("returns Staged when the run mode is staged", () => {
    expect(getRunBranchLabel(makeReviewMetadata({ mode: "staged" }))).toBe("Staged");
  });

  it("returns Unknown branch when the branch is missing", () => {
    expect(getRunBranchLabel(makeReviewMetadata({ mode: "unstaged", branch: null }))).toBe(
      "Unknown branch",
    );
  });

  it("returns Detached HEAD for the detached sentinel branch", () => {
    expect(
      getRunBranchLabel(makeReviewMetadata({ mode: "unstaged", branch: DETACHED_HEAD_BRANCH })),
    ).toBe("Detached HEAD");
  });

  it("shows a branch literally named detached under its own name", () => {
    expect(getRunBranchLabel(makeReviewMetadata({ mode: "unstaged", branch: "detached" }))).toBe(
      "detached",
    );
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

  it("prefers the caller's lookup label over the standalone short id", () => {
    const id = "abcdef00-0000-4000-8000-000000000000";

    expect(resolveRunDisplayId(makeReviewMetadata({ id }), new Map([[id, "#abcdef00-0"]]))).toBe(
      "#abcdef00-0",
    );
    expect(resolveRunDisplayId(makeReviewMetadata({ id }))).toBe("#abcdef00");
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
