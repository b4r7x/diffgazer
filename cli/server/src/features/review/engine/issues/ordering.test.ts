import { describe, expect, it } from "vitest";
import { makeIssue } from "../../../../shared/lib/testing/factories.js";
import {
  deduplicateIssues,
  filterIssuesByMinSeverity,
  sortIssuesBySeverity,
} from "./ordering.js";

describe("deduplicateIssues", () => {
  it("deduplicates by file, line, and case-insensitive title while keeping the highest severity", () => {
    const issues = [
      makeIssue({
        id: "duplicate-low",
        file: "a.ts",
        line_start: 10,
        title: "NULL REFERENCE",
        severity: "low",
      }),
      makeIssue({
        id: "duplicate-high",
        file: "a.ts",
        line_start: 10,
        title: "null reference",
        severity: "high",
      }),
      makeIssue({ id: "different-file", file: "b.ts", line_start: 10, title: "null reference" }),
      makeIssue({ id: "different-line", file: "a.ts", line_start: 20, title: "null reference" }),
      makeIssue({
        id: "null-line-one",
        file: "c.ts",
        line_start: null,
        title: "Same null line",
        severity: "medium",
      }),
      makeIssue({
        id: "null-line-two",
        file: "c.ts",
        line_start: null,
        title: "Same null line",
        severity: "nit",
      }),
    ];
    const result = deduplicateIssues(issues);
    const duplicate = result.find((issue) => issue.file === "a.ts" && issue.line_start === 10);

    expect(result).toHaveLength(4);
    expect(duplicate?.id).toBe("duplicate-high");
    expect(result.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "duplicate-high",
        "different-file",
        "different-line",
        "null-line-one",
      ]),
    );
  });

  it("keeps titles that differ after a shared 50-character prefix", () => {
    const prefix = "same normalized title prefix ".padEnd(60, "x");
    const issues = [
      makeIssue({ id: "first-suffix", title: `${prefix} first` }),
      makeIssue({ id: "second-suffix", title: `${prefix} second` }),
    ];

    expect(deduplicateIssues(issues).map((issue) => issue.id)).toEqual([
      "first-suffix",
      "second-suffix",
    ]);
  });

  it("keeps delimiter-bearing file and title identities distinct", () => {
    const issues = [
      makeIssue({ id: "delimiter-in-file", file: "src:10", line_start: 20, line_end: 20 }),
      makeIssue({
        id: "delimiter-in-title",
        file: "src",
        line_start: 10,
        line_end: 20,
        title: "20:Test issue",
      }),
    ];

    expect(deduplicateIssues(issues).map((issue) => issue.id)).toEqual([
      "delimiter-in-file",
      "delimiter-in-title",
    ]);
  });

  it("treats the end line and category as identity fields", () => {
    const issues = [
      makeIssue({ id: "base", line_end: 15, category: "correctness" }),
      makeIssue({ id: "different-end", line_end: 16, category: "correctness" }),
      makeIssue({ id: "different-category", line_end: 15, category: "security" }),
    ];

    expect(deduplicateIssues(issues).map((issue) => issue.id)).toEqual([
      "base",
      "different-end",
      "different-category",
    ]);
  });
});

describe("sortIssuesBySeverity", () => {
  it("sorts by severity, confidence, and file without mutating the input", () => {
    const issues = [
      makeIssue({ id: "low", severity: "low", file: "b.ts" }),
      makeIssue({ id: "high-z", severity: "high", confidence: 0.8, file: "z.ts" }),
      makeIssue({ id: "blocker", severity: "blocker", file: "c.ts" }),
      makeIssue({ id: "high-a", severity: "high", confidence: 0.8, file: "a.ts" }),
      makeIssue({ id: "high-confidence", severity: "high", confidence: 0.95, file: "m.ts" }),
    ];
    const originalOrder = issues.map((issue) => issue.id);

    const result = sortIssuesBySeverity(issues);

    expect(result.map((issue) => issue.id)).toEqual([
      "blocker",
      "high-confidence",
      "high-a",
      "high-z",
      "low",
    ]);
    expect(issues.map((issue) => issue.id)).toEqual(originalOrder);
  });

  it("produces one transitive order for every permutation of close confidence values", () => {
    const issues = [
      makeIssue({ id: "confidence-800", severity: "high", confidence: 0.8, file: "z.ts" }),
      makeIssue({ id: "confidence-806", severity: "high", confidence: 0.806, file: "a.ts" }),
      makeIssue({ id: "confidence-812", severity: "high", confidence: 0.812, file: "m.ts" }),
    ];
    const permutations = [
      [issues[0], issues[1], issues[2]],
      [issues[0], issues[2], issues[1]],
      [issues[1], issues[0], issues[2]],
      [issues[1], issues[2], issues[0]],
      [issues[2], issues[0], issues[1]],
      [issues[2], issues[1], issues[0]],
    ];

    const outputs = new Set(
      permutations.map((permutation) =>
        sortIssuesBySeverity(permutation.filter((issue) => issue !== undefined))
          .map((issue) => issue.id)
          .join(","),
      ),
    );

    expect(outputs).toEqual(new Set(["confidence-812,confidence-806,confidence-800"]));
  });
});

describe("filterIssuesByMinSeverity", () => {
  it("returns all issues without a filter and removes issues below the minimum severity", () => {
    const issues = [
      makeIssue({ severity: "blocker" }),
      makeIssue({ severity: "high" }),
      makeIssue({ severity: "medium" }),
      makeIssue({ severity: "low" }),
      makeIssue({ severity: "nit" }),
    ];

    const result = filterIssuesByMinSeverity(issues, { minSeverity: "medium" });

    expect(filterIssuesByMinSeverity(issues).map((i) => i.severity)).toEqual([
      "blocker",
      "high",
      "medium",
      "low",
      "nit",
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.severity)).toEqual(["blocker", "high", "medium"]);
  });
});
