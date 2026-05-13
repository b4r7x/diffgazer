import { describe, it, expect } from "vitest";
import { summarizeOutput } from "./trace.js";

describe("summarizeOutput", () => {
  it.each([
    { value: "hello", expected: "hello" },
    { value: [1, 2, 3], expected: "Array[3]" },
    { value: { a: 1, b: 2 }, expected: "Object{a, b}" },
    { value: { a: 1, b: 2, c: 3, d: 4 }, expected: "Object{a, b, c, ...}" },
    { value: null, expected: "null" },
    { value: undefined, expected: "undefined" },
    { value: 42, expected: "42" },
  ])("summarizes $value", ({ value, expected }) => {
    expect(summarizeOutput(value)).toBe(expected);
  });

  it("summarizes long strings with character and line counts", () => {
    const result = summarizeOutput(`a\nb\n${"x".repeat(200)}`);

    expect(result).toContain("chars");
    expect(result).toContain("lines");
  });
});
