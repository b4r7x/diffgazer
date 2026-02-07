import { describe, it, expect } from "vitest";
import { isApiError } from "./use-review-error-handler";

describe("isApiError", () => {
  it("should recognize a valid API error shape", () => {
    expect(isApiError({ status: 404, message: "Not found" })).toBe(true);
  });

  it("should reject null", () => {
    expect(isApiError(null)).toBe(false);
  });

  it("should reject undefined", () => {
    expect(isApiError(undefined)).toBe(false);
  });

  it("should reject a plain string", () => {
    expect(isApiError("error")).toBe(false);
  });

  it("should reject object missing status", () => {
    expect(isApiError({ message: "err" })).toBe(false);
  });

  it("should reject object missing message", () => {
    expect(isApiError({ status: 400 })).toBe(false);
  });

  it("should reject object with non-number status", () => {
    expect(isApiError({ status: "400", message: "err" })).toBe(false);
  });

  it("should reject object with non-string message", () => {
    expect(isApiError({ status: 400, message: 123 })).toBe(false);
  });

  it("should accept objects with extra properties", () => {
    expect(isApiError({ status: 500, message: "Internal error", extra: true })).toBe(true);
  });
});
