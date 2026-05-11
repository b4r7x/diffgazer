import { describe, it, expect } from "vitest";
import {
  isReviewAbort,
  reviewAbort,
  summarizeOutput,
} from "./utils.js";

describe("reviewAbort", () => {
  it("creates review abort objects with an optional step", () => {
    expect(reviewAbort("something failed", "ERR_CODE", "diff")).toEqual({
      kind: "review_abort",
      message: "something failed",
      code: "ERR_CODE",
      step: "diff",
    });
    expect(reviewAbort("msg", "CODE").step).toBeUndefined();
  });
});

describe("isReviewAbort", () => {
  it.each([
    { value: reviewAbort("msg", "CODE", "diff"), expected: true },
    { value: null, expected: false },
    { value: undefined, expected: false },
    { value: new Error("oops"), expected: false },
    { value: { kind: "other", message: "msg", code: "CODE" }, expected: false },
    { value: { kind: "review_abort", code: "CODE" }, expected: false },
  ])("returns $expected for $value", ({ value, expected }) => {
    expect(isReviewAbort(value)).toBe(expected);
  });
});

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
