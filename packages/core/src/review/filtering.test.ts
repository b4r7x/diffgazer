import { describe, it, expect } from "vitest";
import { filterIssuesBySeverity } from "./filtering.js";
import type { ReviewIssue } from "@diffgazer/schemas/review";

const makeIssue = (severity: ReviewIssue["severity"], id: string): ReviewIssue => ({
  id,
  title: `Issue ${id}`,
  severity,
  category: "correctness",
  file: "src/a.ts",
  line: 1,
  description: "desc",
  codeSnippet: "code",
  suggestion: "fix",
});

const issues: ReviewIssue[] = [
  makeIssue("blocker", "1"),
  makeIssue("high", "2"),
  makeIssue("medium", "3"),
  makeIssue("low", "4"),
  makeIssue("nit", "5"),
];

describe("filterIssuesBySeverity", () => {
  it("returns all issues when filter is 'all'", () => {
    const result = filterIssuesBySeverity(issues, "all");

    expect(result).toHaveLength(5);
  });

  it("filters to only matching severity", () => {
    expect(filterIssuesBySeverity(issues, "blocker")).toHaveLength(1);
    expect(filterIssuesBySeverity(issues, "high")).toHaveLength(1);
    expect(filterIssuesBySeverity(issues, "nit")).toHaveLength(1);
  });

  it("returns empty array when no issues match", () => {
    const highOnly = [makeIssue("high", "1")];

    const result = filterIssuesBySeverity(highOnly, "blocker");

    expect(result).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    const result = filterIssuesBySeverity([], "high");

    expect(result).toEqual([]);
  });
});
