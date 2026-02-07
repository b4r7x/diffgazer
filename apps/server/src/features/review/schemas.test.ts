import { describe, it, expect } from "vitest";
import { parseCsvParam } from "./schemas.js";

describe("parseCsvParam", () => {
  it("should parse comma-separated values", () => {
    expect(parseCsvParam("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("should handle single value", () => {
    expect(parseCsvParam("single")).toEqual(["single"]);
  });

  it("should return undefined for empty string", () => {
    expect(parseCsvParam("")).toBeUndefined();
  });

  it("should return undefined for undefined input", () => {
    expect(parseCsvParam(undefined)).toBeUndefined();
  });

  it("should return undefined for null input", () => {
    expect(parseCsvParam(null)).toBeUndefined();
  });

  it("should trim whitespace from items", () => {
    expect(parseCsvParam(" a , b , c ")).toEqual(["a", "b", "c"]);
  });

  it("should filter out empty items after split", () => {
    expect(parseCsvParam("a,,b,")).toEqual(["a", "b"]);
  });

  it("should return undefined when all items are empty", () => {
    expect(parseCsvParam(",,,")).toBeUndefined();
  });
});
