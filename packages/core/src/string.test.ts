import { describe, it, expect } from "vitest";
import { truncate, truncateToDisplayLength } from "./string.js";

describe("truncate", () => {
  it("returns string unchanged if shorter than maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates string and adds default ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
    expect(truncate("hello world", 10)).toBe("hello w...");
  });

  it("uses custom suffix when provided", () => {
    expect(truncate("hello world", 8, "…")).toBe("hello w…");
    expect(truncate("hello world", 10, "--")).toBe("hello wo--");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("handles maxLength equal to string length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("handles maxLength equal to suffix length", () => {
    expect(truncate("hello", 3)).toBe("...");
  });
});

describe("truncateToDisplayLength", () => {
  it("returns combined string if shorter than maxLength", () => {
    expect(truncateToDisplayLength("hello", " world", 20)).toBe("hello world");
  });

  it("truncates from beginning when exceeding maxLength", () => {
    expect(truncateToDisplayLength("hello", " world", 8)).toBe("lo world");
  });

  it("handles empty existing string", () => {
    expect(truncateToDisplayLength("", "hello", 3)).toBe("llo");
  });

  it("handles empty new content", () => {
    expect(truncateToDisplayLength("hello", "", 3)).toBe("llo");
  });

  it("handles exact maxLength match", () => {
    expect(truncateToDisplayLength("hello", " world", 11)).toBe("hello world");
  });
});
