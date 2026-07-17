import { describe, expect, it } from "vitest";
import type { LensStat } from "../schemas/events/index.js";
import type { ReviewIssue } from "../schemas/review/index.js";
import { makeIssue } from "../testing/factories.js";
import {
  buildCategoryStats,
  buildDuplicateCollapseNotice,
  buildHiddenIssuesNotice,
  buildLensSummaryRows,
  buildReviewSummary,
} from "./build-summary.js";

describe("buildReviewSummary", () => {
  it("reports no files with issues for a clean review without inferring analyzed-file count", () => {
    const summary = buildReviewSummary([]);
    expect(summary).toEqual({
      severityCounts: { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 },
      filesWithIssues: 0,
      blockerCount: 0,
      total: 0,
    });
    expect(summary).not.toHaveProperty("filesAnalyzed");
  });

  it("counts unique files and tracks the blocker count", () => {
    const issues: ReviewIssue[] = [
      makeIssue({ id: "1", severity: "blocker", file: "a.ts", line_end: null }),
      makeIssue({ id: "2", severity: "blocker", file: "a.ts", line_end: null }),
      makeIssue({ id: "3", severity: "high", file: "b.ts", line_end: null }),
      makeIssue({ id: "4", severity: "low", file: "c.ts", line_end: null }),
    ];

    const summary = buildReviewSummary(issues);

    expect(summary.total).toBe(4);
    expect(summary.filesWithIssues).toBe(3);
    expect(summary.blockerCount).toBe(2);
    expect(summary.severityCounts).toEqual({
      blocker: 2,
      high: 1,
      medium: 0,
      low: 1,
      nit: 0,
    });
  });
});

describe("buildCategoryStats", () => {
  it("returns an empty list for no issues", () => {
    expect(buildCategoryStats([])).toEqual([]);
  });

  it("counts issues per category with a title-cased name", () => {
    const issues: ReviewIssue[] = [
      makeIssue({ id: "1", severity: "high", category: "security", line_end: null }),
      makeIssue({ id: "2", severity: "low", category: "security", line_end: null }),
      makeIssue({ id: "3", severity: "medium", category: "performance", line_end: null }),
    ];

    const stats = buildCategoryStats(issues);

    expect(stats).toEqual([
      { id: "security", name: "Security", count: 2 },
      { id: "performance", name: "Performance", count: 1 },
    ]);
  });

  it("labels rows by category and never produces a Simplicity row", () => {
    // Issues from the simplicity lens are filed under foreign categories
    // (readability/style/...), so the category breakdown can never show a
    // "Simplicity" row even when the Simplifier agent ran.
    const issues: ReviewIssue[] = [
      makeIssue({ id: "1", severity: "low", category: "readability", line_end: null }),
      makeIssue({ id: "2", severity: "nit", category: "style", line_end: null }),
      makeIssue({ id: "3", severity: "high", category: "correctness", line_end: null }),
    ];

    const stats = buildCategoryStats(issues);
    const names = stats.map((stat) => stat.name);

    expect(names).toEqual(["Readability", "Style", "Correctness"]);
    expect(names).not.toContain("Simplicity");
  });
});

describe("buildHiddenIssuesNotice", () => {
  it("returns null when nothing was dropped below the threshold", () => {
    expect(buildHiddenIssuesNotice(undefined, "low")).toBeNull();
    expect(buildHiddenIssuesNotice(0, "low")).toBeNull();
  });

  it("pluralizes the hidden-count line and names the severity threshold", () => {
    expect(buildHiddenIssuesNotice(1, "low")).toBe(
      "1 below-threshold issue hidden (threshold: low)",
    );
    expect(buildHiddenIssuesNotice(3, "medium")).toBe(
      "3 below-threshold issues hidden (threshold: medium)",
    );
  });

  it("omits the threshold clause when the severity floor is unknown", () => {
    expect(buildHiddenIssuesNotice(2, undefined)).toBe("2 below-threshold issues hidden");
  });
});

describe("buildDuplicateCollapseNotice", () => {
  it("returns null when deduplication did not remove issues", () => {
    expect(buildDuplicateCollapseNotice(undefined, 2)).toBeNull();
    expect(buildDuplicateCollapseNotice(0, 2)).toBeNull();
  });

  it("reports the streamed-to-final count transition with correct plurals", () => {
    expect(buildDuplicateCollapseNotice(1, 1)).toBe(
      "1 duplicate issue collapsed across lenses (2 → 1 issue)",
    );
    expect(buildDuplicateCollapseNotice(2, 3)).toBe(
      "2 duplicate issues collapsed across lenses (5 → 3 issues)",
    );
  });
});

describe("buildLensSummaryRows", () => {
  it("returns no rows when stats are absent", () => {
    expect(buildLensSummaryRows(undefined)).toEqual([]);
  });

  it("maps per-lens stats to labeled rows, carrying failed status and error code", () => {
    const stats: LensStat[] = [
      { lensId: "correctness", issueCount: 2, status: "success" },
      { lensId: "security", issueCount: 0, status: "failed", errorCode: "CANCELLED" },
    ];

    expect(buildLensSummaryRows(stats)).toEqual([
      { lensId: "correctness", label: "Correctness", issueCount: 2, status: "success" },
      {
        lensId: "security",
        label: "Security",
        issueCount: 0,
        status: "failed",
        errorCode: "CANCELLED",
      },
    ]);
  });
});
