import { describe, expect, it } from "vitest";
import { isInputMethod } from "./types.js";

describe("isInputMethod", () => {
  it("accepts the known input methods", () => {
    expect(isInputMethod("paste")).toBe(true);
    expect(isInputMethod("env")).toBe(true);
  });

  it("rejects unknown values and null", () => {
    expect(isInputMethod("keyring")).toBe(false);
    expect(isInputMethod("")).toBe(false);
    expect(isInputMethod(null)).toBe(false);
  });
});
