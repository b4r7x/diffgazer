import { describe, it, expect } from "vitest";
import { calculateSeverityCounts, severityRank, SEVERITY_ORDER } from "./ui.js";
import type { ReviewSeverity } from "../review/issues.js";

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

    expect(counts.blocker).toBe(1);
    expect(counts.high).toBe(2);
    expect(counts.medium).toBe(1);
    expect(counts.low).toBe(1);
    expect(counts.nit).toBe(3);
  });

  it("returns all zeros for empty issues array", () => {
    const counts = calculateSeverityCounts([]);

    expect(counts).toEqual({
      blocker: 0,
      high: 0,
      medium: 0,
      low: 0,
      nit: 0,
    });
  });

  it("handles single severity", () => {
    const issues: { severity: ReviewSeverity }[] = [
      { severity: "blocker" },
      { severity: "blocker" },
    ];

    const counts = calculateSeverityCounts(issues);

    expect(counts.blocker).toBe(2);
    expect(counts.high).toBe(0);
  });
});

describe("severityRank", () => {
  it("returns 0 for blocker (most severe)", () => {
    expect(severityRank("blocker")).toBe(0);
  });

  it("returns correct ordering: blocker < high < medium < low < nit", () => {
    expect(severityRank("blocker")).toBeLessThan(severityRank("high"));
    expect(severityRank("high")).toBeLessThan(severityRank("medium"));
    expect(severityRank("medium")).toBeLessThan(severityRank("low"));
    expect(severityRank("low")).toBeLessThan(severityRank("nit"));
  });

  it("matches SEVERITY_ORDER indices", () => {
    for (let i = 0; i < SEVERITY_ORDER.length; i++) {
      expect(severityRank(SEVERITY_ORDER[i])).toBe(i);
    }
  });
});
