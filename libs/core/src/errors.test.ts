import { describe, expect, it } from "vitest";
import { getErrorMessage, toError } from "./errors.js";

describe("getErrorMessage", () => {
  it.each([
    [new Error("something broke"), undefined, "something broke"],
    ["raw string error", undefined, "raw string error"],
    [{ code: 42 }, undefined, "[object Object]"],
    [null, "fallback msg", "fallback msg"],
    [undefined, "default", "default"],
    [123, undefined, "123"],
  ])("formats %j with fallback %j", (value, fallback, expected) => {
    expect(getErrorMessage(value, fallback)).toBe(expected);
  });
});

describe("toError", () => {
  it("returns Error values unchanged and wraps non-Error values", () => {
    const original = new Error("original");
    const wrapped = toError("string value");

    expect(toError(original)).toBe(original);
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe("string value");
  });
});
