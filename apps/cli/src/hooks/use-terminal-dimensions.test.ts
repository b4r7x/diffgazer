import { describe, it, expect } from "vitest";

interface TerminalDimensions {
  columns: number;
  rows: number;
  isNarrow: boolean;
  isVeryNarrow: boolean;
  isTiny: boolean;
}

interface Options {
  narrowBreakpoint?: number;
  veryNarrowBreakpoint?: number;
  tinyBreakpoint?: number;
}

const DEFAULT_NARROW_BREAKPOINT = 90;
const DEFAULT_VERY_NARROW_BREAKPOINT = 60;
const DEFAULT_TINY_BREAKPOINT = 40;
const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;

function computeDimensions(
  stdout: { columns?: number; rows?: number } | undefined,
  options?: Options
): TerminalDimensions {
  const narrowBreakpoint = options?.narrowBreakpoint ?? DEFAULT_NARROW_BREAKPOINT;
  const veryNarrowBreakpoint = options?.veryNarrowBreakpoint ?? DEFAULT_VERY_NARROW_BREAKPOINT;
  const tinyBreakpoint = options?.tinyBreakpoint ?? DEFAULT_TINY_BREAKPOINT;

  const columns = stdout?.columns ?? DEFAULT_COLUMNS;
  const rows = stdout?.rows ?? DEFAULT_ROWS;

  return {
    columns,
    rows,
    isNarrow: columns < narrowBreakpoint,
    isVeryNarrow: columns < veryNarrowBreakpoint,
    isTiny: columns < tinyBreakpoint,
  };
}

describe("useTerminalDimensions - Dimension Logic", () => {
  describe("default values when stdout unavailable", () => {
    it("returns default dimensions (80x24) when stdout is undefined", () => {
      const dims = computeDimensions(undefined);

      expect(dims.columns).toBe(80);
      expect(dims.rows).toBe(24);
    });

    it("returns default dimensions when stdout has no properties", () => {
      const dims = computeDimensions({});

      expect(dims.columns).toBe(80);
      expect(dims.rows).toBe(24);
    });

    it("returns default columns when only rows provided", () => {
      const dims = computeDimensions({ rows: 30 });

      expect(dims.columns).toBe(80);
      expect(dims.rows).toBe(30);
    });

    it("returns default rows when only columns provided", () => {
      const dims = computeDimensions({ columns: 120 });

      expect(dims.columns).toBe(120);
      expect(dims.rows).toBe(24);
    });
  });

  describe("isNarrow breakpoint", () => {
    it("isNarrow is true when columns < 90 (default)", () => {
      const dims = computeDimensions({ columns: 89, rows: 24 });

      expect(dims.isNarrow).toBe(true);
    });

    it("isNarrow is false when columns >= 90", () => {
      const dims = computeDimensions({ columns: 90, rows: 24 });

      expect(dims.isNarrow).toBe(false);
    });

    it("isNarrow is false for wide terminals", () => {
      const dims = computeDimensions({ columns: 200, rows: 50 });

      expect(dims.isNarrow).toBe(false);
    });

    it("default 80 columns is narrow", () => {
      const dims = computeDimensions(undefined);

      expect(dims.isNarrow).toBe(true);
    });
  });

  describe("isVeryNarrow breakpoint", () => {
    it("isVeryNarrow is true when columns < 60 (default)", () => {
      const dims = computeDimensions({ columns: 59, rows: 24 });

      expect(dims.isVeryNarrow).toBe(true);
    });

    it("isVeryNarrow is false when columns >= 60", () => {
      const dims = computeDimensions({ columns: 60, rows: 24 });

      expect(dims.isVeryNarrow).toBe(false);
    });

    it("isVeryNarrow is false for normal terminals", () => {
      const dims = computeDimensions({ columns: 80, rows: 24 });

      expect(dims.isVeryNarrow).toBe(false);
    });

    it("extremely narrow terminal (40 cols) is very narrow", () => {
      const dims = computeDimensions({ columns: 40, rows: 24 });

      expect(dims.isVeryNarrow).toBe(true);
      expect(dims.isNarrow).toBe(true);
    });
  });

  describe("custom breakpoints", () => {
    it("respects custom narrowBreakpoint", () => {
      const dims = computeDimensions(
        { columns: 100, rows: 24 },
        { narrowBreakpoint: 110 }
      );

      expect(dims.isNarrow).toBe(true);
    });

    it("respects custom veryNarrowBreakpoint", () => {
      const dims = computeDimensions(
        { columns: 70, rows: 24 },
        { veryNarrowBreakpoint: 80 }
      );

      expect(dims.isVeryNarrow).toBe(true);
    });

    it("custom breakpoints work together", () => {
      const dims = computeDimensions(
        { columns: 50, rows: 24 },
        { narrowBreakpoint: 60, veryNarrowBreakpoint: 40 }
      );

      expect(dims.isNarrow).toBe(true);
      expect(dims.isVeryNarrow).toBe(false);
    });

    it("can set narrowBreakpoint lower than default veryNarrowBreakpoint", () => {
      const dims = computeDimensions(
        { columns: 55, rows: 24 },
        { narrowBreakpoint: 50, veryNarrowBreakpoint: 30 }
      );

      expect(dims.isNarrow).toBe(false);
      expect(dims.isVeryNarrow).toBe(false);
    });
  });

  describe("breakpoint boundary conditions", () => {
    it("exactly at narrow breakpoint is not narrow", () => {
      const dims = computeDimensions({ columns: 90, rows: 24 });

      expect(dims.isNarrow).toBe(false);
    });

    it("one below narrow breakpoint is narrow", () => {
      const dims = computeDimensions({ columns: 89, rows: 24 });

      expect(dims.isNarrow).toBe(true);
    });

    it("exactly at veryNarrow breakpoint is not veryNarrow", () => {
      const dims = computeDimensions({ columns: 60, rows: 24 });

      expect(dims.isVeryNarrow).toBe(false);
    });

    it("one below veryNarrow breakpoint is veryNarrow", () => {
      const dims = computeDimensions({ columns: 59, rows: 24 });

      expect(dims.isVeryNarrow).toBe(true);
    });
  });

  describe("flag relationships", () => {
    it("isVeryNarrow implies isNarrow with default breakpoints", () => {
      const dims = computeDimensions({ columns: 50, rows: 24 });

      expect(dims.isVeryNarrow).toBe(true);
      expect(dims.isNarrow).toBe(true);
    });

    it("isNarrow does not imply isVeryNarrow", () => {
      const dims = computeDimensions({ columns: 70, rows: 24 });

      expect(dims.isNarrow).toBe(true);
      expect(dims.isVeryNarrow).toBe(false);
    });

    it("wide terminal has neither flag", () => {
      const dims = computeDimensions({ columns: 120, rows: 40 });

      expect(dims.isNarrow).toBe(false);
      expect(dims.isVeryNarrow).toBe(false);
    });
  });

  describe("isTiny breakpoint", () => {
    it("isTiny is true when columns < 40 (default)", () => {
      const dims = computeDimensions({ columns: 39, rows: 24 });

      expect(dims.isTiny).toBe(true);
    });

    it("isTiny is false when columns >= 40", () => {
      const dims = computeDimensions({ columns: 40, rows: 24 });

      expect(dims.isTiny).toBe(false);
    });

    it("isTiny implies isVeryNarrow and isNarrow", () => {
      const dims = computeDimensions({ columns: 30, rows: 24 });

      expect(dims.isTiny).toBe(true);
      expect(dims.isVeryNarrow).toBe(true);
      expect(dims.isNarrow).toBe(true);
    });

    it("respects custom tinyBreakpoint", () => {
      const dims = computeDimensions(
        { columns: 50, rows: 24 },
        { tinyBreakpoint: 60 }
      );

      expect(dims.isTiny).toBe(true);
    });
  });

  describe("extreme values", () => {
    it("handles zero columns", () => {
      const dims = computeDimensions({ columns: 0, rows: 24 });

      expect(dims.columns).toBe(0);
      expect(dims.isNarrow).toBe(true);
      expect(dims.isVeryNarrow).toBe(true);
      expect(dims.isTiny).toBe(true);
    });

    it("handles very large columns", () => {
      const dims = computeDimensions({ columns: 10000, rows: 24 });

      expect(dims.columns).toBe(10000);
      expect(dims.isNarrow).toBe(false);
      expect(dims.isVeryNarrow).toBe(false);
      expect(dims.isTiny).toBe(false);
    });

    it("handles zero rows", () => {
      const dims = computeDimensions({ columns: 80, rows: 0 });

      expect(dims.rows).toBe(0);
    });
  });
});
