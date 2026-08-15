import { describe, expect, it } from "vitest";
import { getErrorMessage, getErrorStack } from "./errors.js";

describe("getErrorMessage", () => {
  it.each([
    [new Error("something broke"), undefined, "something broke"],
    ["raw string error", undefined, "raw string error"],
    [{ code: 42 }, undefined, "[object Object]"],
    [null, "fallback msg", "fallback msg"],
    [{ code: 99 }, "default", "default"],
    [123, undefined, "123"],
  ])("formats %j with fallback %j", (value, fallback, expected) => {
    expect(getErrorMessage(value, fallback)).toBe(expected);
  });
});

describe("getErrorStack", () => {
  it("returns the stack for Error values and undefined otherwise", () => {
    const error = new Error("boom");

    expect(getErrorStack(error)).toBe(error.stack);
    expect(getErrorStack("plain string")).toBeUndefined();
    expect(getErrorStack({ stack: "fake" })).toBeUndefined();
  });
});
