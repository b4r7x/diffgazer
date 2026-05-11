import { describe, it, expect } from "vitest";
import { parseCsvParam } from "./schemas.js";

describe("parseCsvParam", () => {
  it.each([
    { input: "a,b,c", expected: ["a", "b", "c"] },
    { input: "single", expected: ["single"] },
    { input: " a , b , c ", expected: ["a", "b", "c"] },
    { input: "a,,b,", expected: ["a", "b"] },
  ])("parses $input", ({ input, expected }) => {
    expect(parseCsvParam(input)).toEqual(expected);
  });

  it.each(["", undefined, null, ",,,"])("returns undefined for empty input %s", (input) => {
    expect(parseCsvParam(input)).toBeUndefined();
  });
});
