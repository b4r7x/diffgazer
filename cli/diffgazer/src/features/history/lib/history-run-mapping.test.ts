import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { describe, expect, test } from "vitest";
import {
  HISTORY_ZONE_ORDER,
  nextHistoryZone,
  sortIssuesBySeverity,
} from "./history-run-mapping";

function makeIssue(severity: ReviewIssue["severity"], overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    id: `${severity}-1`,
    severity,
    category: "correctness",
    title: `${severity} issue`,
    file: "src/x.ts",
    line_start: 1,
    line_end: 1,
    rationale: "",
    recommendation: "",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "",
    whyItMatters: "",
    evidence: [],
    ...overrides,
  } as ReviewIssue;
}

describe("nextHistoryZone", () => {
  test("cycles search -> timeline -> runs -> insights -> search", () => {
    expect(nextHistoryZone("search")).toBe("timeline");
    expect(nextHistoryZone("timeline")).toBe("runs");
    expect(nextHistoryZone("runs")).toBe("insights");
    expect(nextHistoryZone("insights")).toBe("search");
  });

  test("zone order list contains all four zones", () => {
    expect(HISTORY_ZONE_ORDER).toEqual(["search", "timeline", "runs", "insights"]);
  });

  test("applying nextHistoryZone four times returns to the start", () => {
    const start = HISTORY_ZONE_ORDER[0];
    if (start === undefined) throw new Error("HISTORY_ZONE_ORDER is empty");
    let zone = start;
    for (let i = 0; i < HISTORY_ZONE_ORDER.length; i++) {
      zone = nextHistoryZone(zone);
    }
    expect(zone).toBe(start);
  });
});

describe("sortIssuesBySeverity", () => {
  test("returns empty array when no issues", () => {
    expect(sortIssuesBySeverity(undefined)).toEqual([]);
    expect(sortIssuesBySeverity([])).toEqual([]);
  });

  test("orders blocker > high > medium > low > nit", () => {
    const issues: ReviewIssue[] = [
      makeIssue("low"),
      makeIssue("blocker"),
      makeIssue("nit"),
      makeIssue("medium"),
      makeIssue("high"),
    ];
    const sorted = sortIssuesBySeverity(issues).map((i) => i.severity);
    expect(sorted).toEqual(["blocker", "high", "medium", "low", "nit"]);
  });

  test("does not mutate the input array", () => {
    const issues = [makeIssue("low"), makeIssue("blocker")];
    const before = issues.map((i) => i.severity);
    sortIssuesBySeverity(issues);
    expect(issues.map((i) => i.severity)).toEqual(before);
  });

  test("preserves relative order within a single severity (stable-style ordering)", () => {
    const issues: ReviewIssue[] = [
      makeIssue("high", { id: "h1" }),
      makeIssue("high", { id: "h2" }),
      makeIssue("blocker", { id: "b1" }),
      makeIssue("high", { id: "h3" }),
    ];
    const sortedIds = sortIssuesBySeverity(issues).map((i) => i.id);
    expect(sortedIds).toEqual(["b1", "h1", "h2", "h3"]);
  });
});
