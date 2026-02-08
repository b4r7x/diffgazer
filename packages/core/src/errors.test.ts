import { describe, it, expect } from "vitest";
import { getErrorMessage, toError } from "./errors.js";

describe("getErrorMessage", () => {
  it("should return .message when given an Error instance", () => {
    const error = new Error("something broke");

    expect(getErrorMessage(error)).toBe("something broke");
  });

  it("should return the string when given a string", () => {
    expect(getErrorMessage("raw string error")).toBe("raw string error");
  });

  it("should return String(obj) when given an object without fallback", () => {
    const obj = { code: 42 };

    expect(getErrorMessage(obj)).toBe(String(obj));
  });

  it("should return fallback when given null", () => {
    expect(getErrorMessage(null, "fallback msg")).toBe("fallback msg");
  });

  it("should return fallback when given undefined", () => {
    expect(getErrorMessage(undefined, "default")).toBe("default");
  });

  it("should return String(value) when given non-Error without fallback", () => {
    expect(getErrorMessage(123)).toBe("123");
  });
});

describe("toError", () => {
  it("should return the same Error instance when given an Error", () => {
    const original = new Error("original");

    const result = toError(original);

    expect(result).toBe(original);
  });

  it("should wrap a string in an Error", () => {
    const result = toError("string value");

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("string value");
  });
});
