import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { isReviewAbort, reviewAbort } from "./abort.js";

describe("reviewAbort", () => {
  it("creates review abort objects with an optional step", () => {
    expect(reviewAbort("something failed", ReviewErrorCode.GIT_NOT_FOUND, "diff")).toEqual({
      kind: "review_abort",
      message: "something failed",
      code: "GIT_NOT_FOUND",
      step: "diff",
    });
    expect(reviewAbort("msg", ReviewErrorCode.AI_ERROR).step).toBeUndefined();
  });

  it("rejects a code outside the review-error union at compile time", () => {
    // @ts-expect-error — only ReviewErrorCode members are accepted, so a code
    // that would silently collapse to GENERATION_FAILED on the wire is a compile error.
    reviewAbort("msg", "NOT_A_REVIEW_CODE");
  });
});

describe("isReviewAbort", () => {
  it.each([
    { value: reviewAbort("msg", ReviewErrorCode.AI_ERROR, "diff"), expected: true },
    { value: reviewAbort("msg", ReviewErrorCode.AI_ERROR), expected: true },
    { value: null, expected: false },
    { value: undefined, expected: false },
    { value: new Error("oops"), expected: false },
    { value: { kind: "other", message: "msg", code: "CODE" }, expected: false },
    { value: { kind: "review_abort", code: "CODE" }, expected: false },
    {
      value: { kind: "review_abort", message: "bad code", code: "NOT_A_REVIEW_CODE" },
      expected: false,
    },
    {
      value: {
        kind: "review_abort",
        message: "bad step",
        code: ReviewErrorCode.AI_ERROR,
        step: "not-a-step",
      },
      expected: false,
    },
  ])("returns $expected for $value", ({ value, expected }) => {
    expect(isReviewAbort(value)).toBe(expected);
  });
});
