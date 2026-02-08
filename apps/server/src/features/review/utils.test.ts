import { describe, it, expect } from "vitest";
import {
  isReviewAbort,
  reviewAbort,
  summarizeOutput,
} from "./utils.js";

describe("reviewAbort", () => {
  it("should create a ReviewAbort object", () => {
    const abort = reviewAbort("something failed", "ERR_CODE", "diff");
    expect(abort).toEqual({
      kind: "review_abort",
      message: "something failed",
      code: "ERR_CODE",
      step: "diff",
    });
  });

  it("should allow step to be undefined", () => {
    const abort = reviewAbort("msg", "CODE");
    expect(abort.step).toBeUndefined();
  });
});

describe("isReviewAbort", () => {
  it("should return true for ReviewAbort objects", () => {
    const abort = reviewAbort("msg", "CODE", "diff");
    expect(isReviewAbort(abort)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isReviewAbort(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isReviewAbort(undefined)).toBe(false);
  });

  it("should return false for plain errors", () => {
    expect(isReviewAbort(new Error("oops"))).toBe(false);
  });

  it("should return false for objects with wrong kind", () => {
    expect(
      isReviewAbort({ kind: "other", message: "msg", code: "CODE" }),
    ).toBe(false);
  });

  it("should return false for objects missing message", () => {
    expect(isReviewAbort({ kind: "review_abort", code: "CODE" })).toBe(false);
  });
});

describe("summarizeOutput", () => {
  it("should return short strings as-is", () => {
    expect(summarizeOutput("hello")).toBe("hello");
  });

  it("should summarize long strings with char/line count", () => {
    const long = "a\nb\n" + "x".repeat(200);
    const result = summarizeOutput(long);
    expect(result).toContain("chars");
    expect(result).toContain("lines");
  });

  it("should summarize arrays with length", () => {
    expect(summarizeOutput([1, 2, 3])).toBe("Array[3]");
  });

  it("should summarize objects with keys", () => {
    expect(summarizeOutput({ a: 1, b: 2 })).toBe("Object{a, b}");
  });

  it("should truncate object keys beyond 3", () => {
    expect(summarizeOutput({ a: 1, b: 2, c: 3, d: 4 })).toBe(
      "Object{a, b, c, ...}",
    );
  });

  it("should handle null", () => {
    expect(summarizeOutput(null)).toBe("null");
  });

  it("should handle undefined", () => {
    expect(summarizeOutput(undefined)).toBe("undefined");
  });

  it("should handle numbers", () => {
    expect(summarizeOutput(42)).toBe("42");
  });
});
