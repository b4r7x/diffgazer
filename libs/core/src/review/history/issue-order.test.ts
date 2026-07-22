import { describe, expect, it } from "vitest";
import { makeIssue } from "../../testing/factories.js";
import { sortIssuesBySeverity } from "../history.js";

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
