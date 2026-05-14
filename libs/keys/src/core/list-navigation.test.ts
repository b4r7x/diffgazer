import { describe, expect, it } from "vitest";
import { clampIndex } from "./list-navigation.js";

describe("clampIndex", () => {
  it("clamps at the upper bound without wrap", () => {
    expect(clampIndex(2, 1, 3, false)).toBe(2);
  });

  it("clamps at the lower bound without wrap", () => {
    expect(clampIndex(0, -1, 3, false)).toBe(0);
  });

  it("wraps from the last to the first index", () => {
    expect(clampIndex(2, 1, 3, true)).toBe(0);
  });

  it("wraps from the first to the last index", () => {
    expect(clampIndex(0, -1, 3, true)).toBe(2);
  });

  it("returns 0 when length is zero", () => {
    expect(clampIndex(0, 1, 0, true)).toBe(0);
    expect(clampIndex(0, -1, 0, false)).toBe(0);
  });

  it("steps forward inside the range", () => {
    expect(clampIndex(1, 1, 4, false)).toBe(2);
  });

  it("steps backward inside the range", () => {
    expect(clampIndex(2, -1, 4, true)).toBe(1);
  });
});
