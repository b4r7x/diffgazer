import { describe, expect, it } from "vitest";
import { isApiError } from "./types.js";

describe("isApiError", () => {
  it("accepts an Error carrying a numeric status, with or without a string code", () => {
    expect(isApiError(Object.assign(new Error("boom"), { status: 500 }))).toBe(true);
    expect(
      isApiError(Object.assign(new Error("boom"), { status: 403, code: "TRUST_REQUIRED" })),
    ).toBe(true);
  });

  it("rejects values that cannot satisfy the ApiError contract", () => {
    // Not an Error: consumers read inherited Error members off the narrowed type.
    expect(isApiError({ status: 500, message: "failed" })).toBe(false);
    // `code` is declared as an optional string; a non-string must not narrow.
    expect(isApiError(Object.assign(new Error("boom"), { status: 500, code: 42 }))).toBe(false);
    expect(isApiError(new Error("no status"))).toBe(false);
    expect(isApiError(Object.assign(new Error("boom"), { status: "500" }))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});
