import { test, describe, expect } from "vitest";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { buildLensStats } from "./summary-view-helpers.js";

function makeIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    id: "i-1",
    title: "Hard-coded secret",
    severity: "high",
    category: "security",
    file: "src/foo.ts",
    line_start: 1,
    line_end: 1,
    rationale: "rationale",
    symptom: "symptom",
    whyItMatters: "matters",
    recommendation: "recommend",
    confidence: 0.9,
    evidence: [],
    ...overrides,
  } as ReviewIssue;
}

describe("buildLensStats", () => {
  test("returns empty list for empty issues", () => {
    expect(buildLensStats([])).toEqual([]);
  });

  test("aggregates one row per category with counts", () => {
    const issues = [
      makeIssue({ id: "a", category: "security" }),
      makeIssue({ id: "b", category: "security" }),
      makeIssue({ id: "c", category: "performance" }),
    ];
    const stats = buildLensStats(issues);
    const byId = new Map(stats.map((s) => [s.id, s]));

    expect(stats.length).toBe(2);
    expect(byId.get("security")?.count).toBe(2);
    expect(byId.get("security")?.name).toBe("Security");
    expect(byId.get("performance")?.count).toBe(1);
    expect(byId.get("performance")?.name).toBe("Performance");
  });

  test("change is zero (no historical comparison in CLI)", () => {
    const issues = [makeIssue({ id: "a", category: "security" })];
    expect(buildLensStats(issues)[0]?.change).toBe(0);
  });
});
