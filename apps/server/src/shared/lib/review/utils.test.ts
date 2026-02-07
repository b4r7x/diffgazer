import { describe, it, expect } from "vitest";
import { estimateTokens, getThinkingMessage } from "./utils.js";
import type { Lens } from "@stargazer/schemas/review";

const makeLens = (id: string, name: string): Lens =>
  ({ id, name } as Lens);

describe("estimateTokens", () => {
  it("should return 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("should return reasonable estimate (~4 chars per token)", () => {
    const text = "hello world"; // 11 chars
    expect(estimateTokens(text)).toBe(Math.ceil(11 / 4));
  });

  it("should handle long text", () => {
    const text = "a".repeat(1000);
    expect(estimateTokens(text)).toBe(250);
  });
});

describe("getThinkingMessage", () => {
  it("should return correctness message", () => {
    expect(getThinkingMessage(makeLens("correctness", "Correctness"))).toBe(
      "Analyzing diff for bugs and logic errors...",
    );
  });

  it("should return security message", () => {
    expect(getThinkingMessage(makeLens("security", "Security"))).toBe(
      "Analyzing diff for security vulnerabilities...",
    );
  });

  it("should return performance message", () => {
    expect(getThinkingMessage(makeLens("performance", "Performance"))).toBe(
      "Analyzing diff for performance issues...",
    );
  });

  it("should return simplicity message", () => {
    expect(getThinkingMessage(makeLens("simplicity", "Simplicity"))).toBe(
      "Analyzing diff for complexity and maintainability...",
    );
  });

  it("should return tests message", () => {
    expect(getThinkingMessage(makeLens("tests", "Tests"))).toBe(
      "Analyzing diff for test coverage and quality...",
    );
  });

  it("should return generic message for unknown lens", () => {
    expect(getThinkingMessage(makeLens("custom", "My Lens"))).toBe(
      "Analyzing diff with My Lens lens...",
    );
  });
});
