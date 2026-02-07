import { describe, it, expect } from "vitest";
import { createError, getErrorMessage, toError } from "./errors.js";

describe("createError", () => {
  it("creates an AppError with code, message, and details", () => {
    const error = createError("NOT_FOUND", "Resource not found", "id=123");

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Resource not found");
    expect(error.details).toBe("id=123");
  });

  it("creates an AppError without details", () => {
    const error = createError("GENERIC", "Something went wrong");

    expect(error.details).toBeUndefined();
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error object", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("returns string directly", () => {
    expect(getErrorMessage("string error")).toBe("string error");
  });

  it("uses fallback for non-Error objects when provided", () => {
    expect(getErrorMessage(42, "fallback")).toBe("fallback");
  });

  it("stringifies non-Error objects without fallback", () => {
    expect(getErrorMessage(42)).toBe("42");
  });

  it("stringifies null without fallback", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("stringifies undefined without fallback", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("uses fallback for null when provided", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
  });
});

describe("toError", () => {
  it("returns Error objects unchanged", () => {
    const error = new Error("original");
    expect(toError(error)).toBe(error);
  });

  it("wraps strings in Error", () => {
    const result = toError("string error");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("string error");
  });

  it("wraps numbers in Error", () => {
    const result = toError(404);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("404");
  });

  it("wraps null in Error", () => {
    const result = toError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });
});
