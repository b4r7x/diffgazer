import { describe, expect, it } from "vitest";
import type { ReviewIssue, ReviewSeverity } from "../schemas/review/index.js";
import { filterIssuesBySeverity, toggleSeverity } from "./filtering.js";

const makeIssue = (severity: ReviewIssue["severity"], id: string): ReviewIssue => ({
  id,
  title: `Issue ${id}`,
  severity,
  category: "correctness",
  file: "src/a.ts",
  line_start: 1,
  line_end: null,
  rationale: "desc",
  recommendation: "fix",
  suggested_patch: null,
  confidence: 0.9,
  symptom: "symptom",
  whyItMatters: "matters",
  evidence: [],
});

const issueSummary = (items: ReviewIssue[]) => items.map(({ id, severity }) => ({ id, severity }));

const issues: ReviewIssue[] = [
  makeIssue("blocker", "blocker-1"),
  makeIssue("high", "high-1"),
  makeIssue("medium", "medium-1"),
  makeIssue("high", "high-2"),
  makeIssue("low", "low-1"),
  makeIssue("nit", "nit-1"),
];

describe("filterIssuesBySeverity", () => {
  it("returns all issues when filter set is empty", () => {
    const result = filterIssuesBySeverity(issues, new Set());

    expect(issueSummary(result)).toEqual([
      { id: "blocker-1", severity: "blocker" },
      { id: "high-1", severity: "high" },
      { id: "medium-1", severity: "medium" },
      { id: "high-2", severity: "high" },
      { id: "low-1", severity: "low" },
      { id: "nit-1", severity: "nit" },
    ]);
  });

  it("includes High exactly and excludes Blocker", () => {
    const filter = new Set<ReviewSeverity>(["high"]);
    expect(issueSummary(filterIssuesBySeverity(issues, filter))).toEqual([
      { id: "high-1", severity: "high" },
      { id: "high-2", severity: "high" },
    ]);
  });

  it("returns empty array when no issues match", () => {
    const highOnly = [makeIssue("high", "1")];
    const filter = new Set<ReviewSeverity>(["blocker"]);

    const result = filterIssuesBySeverity(highOnly, filter);

    expect(result).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    const filter = new Set<ReviewSeverity>(["high"]);
    const result = filterIssuesBySeverity([], filter);

    expect(result).toEqual([]);
  });

  it("returns the exact non-contiguous union of selected severities", () => {
    const filter = new Set<ReviewSeverity>(["blocker", "low"]);

    const result = filterIssuesBySeverity(issues, filter);

    expect(issueSummary(result)).toEqual([
      { id: "blocker-1", severity: "blocker" },
      { id: "low-1", severity: "low" },
    ]);
  });
});

describe("toggleSeverity", () => {
  it("adds a severity not already in the filter", () => {
    const result = toggleSeverity(new Set<ReviewSeverity>(["high"]), "blocker");
    expect([...result].sort()).toEqual(["blocker", "high"]);
  });

  it("removes a severity already in the filter", () => {
    const result = toggleSeverity(new Set<ReviewSeverity>(["high", "blocker"]), "high");
    expect([...result]).toEqual(["blocker"]);
  });

  it("does not mutate the input set", () => {
    const input = new Set<ReviewSeverity>(["high"]);
    toggleSeverity(input, "blocker");
    expect([...input]).toEqual(["high"]);
  });
});
