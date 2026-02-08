import { describe, it, expect } from "vitest";
import { calculateSeverityCounts, severityRank } from "./ui.js";
import type { ReviewSeverity } from "../review/issues.js";

describe("severityRank", () => {
  it("returns lower rank for more severe levels", () => {
    expect(severityRank("blocker")).toBeLessThan(severityRank("high"));
    expect(severityRank("high")).toBeLessThan(severityRank("medium"));
    expect(severityRank("medium")).toBeLessThan(severityRank("low"));
    expect(severityRank("low")).toBeLessThan(severityRank("nit"));
  });

  it("returns 0 for blocker", () => {
    expect(severityRank("blocker")).toBe(0);
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
