import { describe, expect, it } from "vitest";
import type { ReviewSeverity } from "../review/issues.js";
import { calculateSeverityCounts, severityRank } from "./severity.js";

describe("severityRank", () => {
  it("sorts severities from most to least severe", () => {
    const severities: ReviewSeverity[] = ["nit", "low", "medium", "high", "blocker"];

    const sorted = [...severities].sort((a, b) => severityRank(a) - severityRank(b));

    expect(sorted).toEqual(["blocker", "high", "medium", "low", "nit"]);
  });
});

describe("calculateSeverityCounts", () => {
  it("counts each severity level", () => {
    const issues: { severity: ReviewSeverity }[] = [
      { severity: "blocker" },
      { severity: "high" },
      { severity: "high" },
      { severity: "medium" },
      { severity: "low" },
      { severity: "nit" },
      { severity: "nit" },
      { severity: "nit" },
    ];

    const counts = calculateSeverityCounts(issues);

    expect(counts).toEqual({ blocker: 1, high: 2, medium: 1, low: 1, nit: 3 });
  });

  it("returns all zeros for empty input", () => {
    const counts = calculateSeverityCounts([]);

    expect(counts).toEqual({ blocker: 0, high: 0, medium: 0, low: 0, nit: 0 });
  });

  it("handles single severity", () => {
    const issues = [{ severity: "medium" as const }];

    const counts = calculateSeverityCounts(issues);

    expect(counts.medium).toBe(1);
    expect(counts.blocker).toBe(0);
  });
});
