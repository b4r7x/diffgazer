import { describe, it, expect } from "vitest";
import {
  isReviewAbort,
  reviewAbort,
} from "./abort.js";

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
