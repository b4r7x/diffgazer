import { buildSeverityBreakdownRows } from "@diffgazer/core/review";
import { describe, expect, test } from "vitest";
import { allocateRibbonCells } from "./ribbon";

const ROWS = buildSeverityBreakdownRows({ blocker: 1, high: 2, medium: 2, low: 2, nit: 1 });

describe("allocateRibbonCells", () => {
  test.each([1, 5, 8, 27, 56, 80])("fills exactly %i cells", (width) => {
    const segments = allocateRibbonCells(ROWS, width);
    expect(segments.reduce((sum, segment) => sum + segment.cells, 0)).toBe(width);
  });

  test("gives every severity that occurred at least one cell", () => {
    const segments = allocateRibbonCells(ROWS, 8);

    expect(segments).toHaveLength(5);
    for (const segment of segments) {
      expect(segment.cells).toBeGreaterThanOrEqual(1);
    }
  });

  test("leaves out severities with no issues", () => {
    const segments = allocateRibbonCells(
      buildSeverityBreakdownRows({ blocker: 0, high: 3, medium: 0, low: 1, nit: 0 }),
      20,
    );

    expect(segments.map((segment) => segment.severity)).toEqual(["high", "low"]);
  });

  test("keeps the first severities in order when the row is narrower than the severity count", () => {
    const segments = allocateRibbonCells(ROWS, 3);

    expect(segments.map((segment) => segment.severity)).toEqual(["blocker", "high", "medium"]);
    expect(segments.map((segment) => segment.cells)).toEqual([1, 1, 1]);
  });

  test("draws nothing for an empty run", () => {
    expect(
      allocateRibbonCells(
        buildSeverityBreakdownRows({ blocker: 0, high: 0, medium: 0, low: 0, nit: 0 }),
        20,
      ),
    ).toEqual([]);
  });
});
