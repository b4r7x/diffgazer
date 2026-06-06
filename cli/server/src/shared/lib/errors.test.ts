import { describe, expect, it } from "vitest";
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
  it("returns the first matching rule for an Error containing a known pattern", () => {
    const result = classifyError(new Error("Connection ECONNREFUSED"), rules, fallback);

    expect(result).toEqual({ code: "NETWORK", message: "Network error" });
  });

  it("falls back to the fallback rule when no pattern matches", () => {
    const result = classifyError(new Error("Something weird"), rules, fallback);

    expect(result).toEqual({ code: "UNKNOWN", message: "Unexpected: Something weird" });
  });

  it("matches patterns case-insensitively against the error text", () => {
    const result = classifyError(new Error("UNAUTHORIZED access"), rules, fallback);

    expect(result).toEqual({ code: "AUTH", message: "Auth error" });
  });

  it.each([
    {
      description: "raw string input",
      input: "timeout occurred",
      expected: { code: "NETWORK" as const, message: "Network error" },
    },
    {
      description: "non-Error object input",
      input: { error: true },
      expected: { code: "UNKNOWN" as const, message: "Unexpected: [object Object]" },
    },
    {
      description: "undefined input",
      input: undefined,
      expected: { code: "UNKNOWN" as const, message: "Unexpected: undefined" },
    },
  ])("handles $description by stringifying and matching", ({ input, expected }) => {
    expect(classifyError(input, rules, fallback)).toEqual(expected);
  });

  it("preserves the original casing of the error message in the fallback output", () => {
    const result = classifyError(new Error("CamelCase Error"), rules, fallback);

    expect(result.message).toBe("Unexpected: CamelCase Error");
  });
});
