import { describe, it, expect } from "vitest";
import { classifyError, type ErrorRule } from "./errors.js";

type TestCode = "NETWORK" | "AUTH" | "UNKNOWN";

const rules: ErrorRule<TestCode>[] = [
  { patterns: ["econnrefused", "timeout"], code: "NETWORK", message: "Network error" },
  { patterns: ["unauthorized", "forbidden"], code: "AUTH", message: "Auth error" },
];

const fallback = {
  code: "UNKNOWN" as const,
  message: (msg: string) => `Unexpected: ${msg}`,
};

describe("classifyError", () => {
  it("should match the first matching rule pattern", () => {
    const result = classifyError(new Error("Connection ECONNREFUSED"), rules, fallback);

    expect(result).toEqual({ code: "NETWORK", message: "Network error" });
  });

  it("should return fallback when no patterns match", () => {
    const result = classifyError(new Error("Something weird"), rules, fallback);

    expect(result).toEqual({ code: "UNKNOWN", message: "Unexpected: Something weird" });
  });

  it("should be case-insensitive pattern matching", () => {
    const result = classifyError(new Error("UNAUTHORIZED access"), rules, fallback);

    expect(result).toEqual({ code: "AUTH", message: "Auth error" });
  });

  it("should handle non-Error thrown values", () => {
    // string
    expect(classifyError("timeout occurred", rules, fallback)).toEqual({
      code: "NETWORK",
      message: "Network error",
    });

    // object
    expect(classifyError({ error: true }, rules, fallback)).toEqual({
      code: "UNKNOWN",
      message: "Unexpected: [object Object]",
    });

    // undefined
    expect(classifyError(undefined, rules, fallback)).toEqual({
      code: "UNKNOWN",
      message: "Unexpected: undefined",
    });
  });

  it("should use original error message (not lowercased) in fallback", () => {
    const result = classifyError(new Error("CamelCase Error"), rules, fallback);

    expect(result.message).toBe("Unexpected: CamelCase Error");
  });
});
