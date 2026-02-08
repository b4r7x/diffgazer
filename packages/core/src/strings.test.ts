import { describe, it, expect } from "vitest";
import { capitalize, truncate } from "./strings.js";

describe("capitalize", () => {
  it("should capitalize the first character of a string", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("should return empty string unchanged", () => {
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
    expect(truncate("hello world", 2)).toBe("..");
    expect(truncate("hello world", 1)).toBe(".");
    expect(truncate("hello world", 0)).toBe("");
  });

  it("handles maxLength equal to suffix length", () => {
    expect(truncate("hello world", 3)).toBe("...");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});
