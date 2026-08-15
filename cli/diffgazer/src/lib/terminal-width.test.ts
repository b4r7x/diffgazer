import { describe, expect, it } from "vitest";
import { terminalCellWidth, wrappedRowCount } from "./terminal-width";

const WIDE_COMBINING_EMOJI = "\u3044e\u0301\uD83D\uDE42";

describe("terminalCellWidth", () => {
  it("counts a wide glyph as two cells, a combining mark as zero and an emoji as two", () => {
    expect(terminalCellWidth(WIDE_COMBINING_EMOJI)).toBe(5);
  });
});

describe("wrappedRowCount", () => {
  it("reports the rows a string occupies once wrapped to a column budget", () => {
    expect(wrappedRowCount(WIDE_COMBINING_EMOJI, 4)).toBe(2);
  });

  it("never reports fewer than one row", () => {
    expect(wrappedRowCount("", 40)).toBe(1);
  });
});
