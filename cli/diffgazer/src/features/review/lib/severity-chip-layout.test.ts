import { describe, expect, test } from "vitest";
import { getSeverityChipLayout } from "./severity-chip-layout";

describe("getSeverityChipLayout", () => {
  const LABELS = ["BLOCKER 1", "HIGH 3", "MED 3", "LOW 3", "NIT 2"];

  test("keeps every chip on one row when the row fits", () => {
    expect(getSeverityChipLayout({ labels: LABELS, hasReset: false, contentWidth: 56 })).toEqual({
      mode: "full",
      rows: 1,
    });
  });

  test("wraps rather than abbreviating when a whole chip still fits", () => {
    expect(getSeverityChipLayout({ labels: LABELS, hasReset: false, contentWidth: 31 })).toEqual({
      mode: "wrapped",
      rows: 2,
    });
  });

  test("counts whole chips per row rather than dividing the summed width", () => {
    // Chips [12, 9, 8, 8, 8, 7] with 1-column gaps pack as 12+9 | 8+8+8 | 7 in a
    // 30-column list pane; dividing the 57-column total would claim two rows.
    expect(
      getSeverityChipLayout({
        labels: ["BLOCKER 10", "HIGH 10", "MED 10", "LOW 10", "NIT 10"],
        hasReset: true,
        contentWidth: 30,
      }),
    ).toEqual({ mode: "wrapped", rows: 3 });
  });

  test("abbreviates only when the widest chip cannot fit on a line", () => {
    expect(getSeverityChipLayout({ labels: LABELS, hasReset: false, contentWidth: 10 }).mode).toBe(
      "short",
    );
  });
});
