import { test, describe, expect } from "vitest";
import { getVisibleSliceOffset } from "./visible-slice-offset.js";

describe("getVisibleSliceOffset", () => {
  test("returns 0 when total fits in the window", () => {
    expect(getVisibleSliceOffset(0, 5, 10)).toBe(0);
    expect(getVisibleSliceOffset(4, 5, 10)).toBe(0);
  });

  test("returns 0 while the highlight is within the first window", () => {
    expect(getVisibleSliceOffset(0, 20, 10)).toBe(0);
    expect(getVisibleSliceOffset(9, 20, 10)).toBe(0);
  });

  test("scrolls so the highlight stays on the bottom row", () => {
    expect(getVisibleSliceOffset(10, 20, 10)).toBe(1);
    expect(getVisibleSliceOffset(15, 20, 10)).toBe(6);
  });

  test("clamps to the maximum offset when reaching the end", () => {
    expect(getVisibleSliceOffset(19, 20, 10)).toBe(10);
    expect(getVisibleSliceOffset(100, 20, 10)).toBe(10);
  });

  test("handles a window of size 1", () => {
    expect(getVisibleSliceOffset(0, 5, 1)).toBe(0);
    expect(getVisibleSliceOffset(3, 5, 1)).toBe(3);
    expect(getVisibleSliceOffset(4, 5, 1)).toBe(4);
  });
});
