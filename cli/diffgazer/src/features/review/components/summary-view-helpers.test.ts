import assert from "node:assert/strict";
import test, { describe } from "node:test";
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
    assert.deepEqual(buildLensStats([]), []);
  });

  test("aggregates one row per category with counts", () => {
    const issues = [
      makeIssue({ id: "a", category: "security" }),
      makeIssue({ id: "b", category: "security" }),
      makeIssue({ id: "c", category: "performance" }),
    ];
    const stats = buildLensStats(issues);
    const byId = new Map(stats.map((s) => [s.id, s]));

    assert.equal(stats.length, 2);
    assert.equal(byId.get("security")?.count, 2);
    assert.equal(byId.get("security")?.name, "Security");
    assert.equal(byId.get("performance")?.count, 1);
    assert.equal(byId.get("performance")?.name, "Performance");
  });

  test("change is zero (no historical comparison in CLI)", () => {
    const issues = [makeIssue({ id: "a", category: "security" })];
    assert.equal(buildLensStats(issues)[0]?.change, 0);
  });
});
