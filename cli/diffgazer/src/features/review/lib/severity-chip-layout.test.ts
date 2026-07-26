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

  test("abbreviates only when the widest chip cannot fit on a line", () => {
    expect(getSeverityChipLayout({ labels: LABELS, hasReset: false, contentWidth: 10 }).mode).toBe(
      "short",
    );
  });
});
