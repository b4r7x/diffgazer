import { describe, it, expect } from "vitest";
import { isApiError } from "./use-review-error-handler";

describe("isApiError", () => {
  it("should return true for valid ApiError object", () => {
    expect(isApiError({ status: 400, message: "Bad request" })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isApiError(null)).toBe(false);
  });

  it("should return false for plain Error", () => {
    expect(isApiError(new Error("fail"))).toBe(false);
  });

  it("should return false for object missing status", () => {
    expect(isApiError({ message: "no status" })).toBe(false);
  });

  it("should return false for object with non-number status", () => {
    expect(isApiError({ status: "400", message: "string status" })).toBe(false);
  });
});
