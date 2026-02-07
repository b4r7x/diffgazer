import { describe, it, expect } from "vitest";
import { capitalize, truncate } from "./strings.js";

describe("capitalize", () => {
  it("capitalizes the first character", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("returns empty string unchanged", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("truncate", () => {
  it("truncates string longer than maxLength", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  it("returns string shorter than maxLength unchanged", () => {
    expect(truncate("hi", 10)).toBe("hi");
  });

  it("returns string equal to maxLength unchanged", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("uses default suffix of '...'", () => {
    const result = truncate("abcdefghij", 6);
    expect(result).toBe("abc...");
    expect(result.length).toBe(6);
  });

  it("uses custom suffix", () => {
    expect(truncate("abcdefghij", 6, "~")).toBe("abcde~");
  });

  it("handles maxLength less than suffix length", () => {
    // slice(0, 2-3) = slice(0, -1) removes last char, then appends "..."
    // Result is longer than maxLength — the function doesn't clamp
    const result = truncate("hello world", 2);
    expect(result).toBe("hello worl...");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});
