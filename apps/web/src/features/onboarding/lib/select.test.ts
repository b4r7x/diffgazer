import { describe, expect, it } from "vitest";
import { resolveAvailableValue } from "./select";

describe("resolveAvailableValue", () => {
  it("returns the first candidate found in the values tuple", () => {
    expect(resolveAvailableValue(["a", "b", "c"] as const, "b")).toBe("b");
  });

  it("walks candidates in order and stops on the first hit", () => {
    expect(resolveAvailableValue(["a", "b"] as const, "b", "a")).toBe("b");
  });

  it("falls back to the first available value when no candidate matches", () => {
    expect(resolveAvailableValue(["x", "y"] as const, "unknown")).toBe("x");
  });

  it("falls back when candidates are null or undefined", () => {
    expect(resolveAvailableValue(["x", "y"] as const, null, undefined)).toBe("x");
  });

  it("returns null when values is empty", () => {
    expect(resolveAvailableValue([] as const, "x")).toBe(null);
  });
});
