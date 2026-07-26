import { describe, expect, it } from "vitest";
import { spinAt } from "./motion";

describe("spinAt", () => {
  it("cycles through every frame and wraps back to the first", () => {
    const cycle = Array.from({ length: 8 }, (_, index) => spinAt(index));

    expect(new Set(cycle).size).toBe(cycle.length);
    expect(spinAt(8)).toBe(cycle[0]);
    expect(spinAt(11)).toBe(cycle[3]);
  });
});
