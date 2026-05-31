import { describe, it, expect } from "vitest";
import { parsePortEnv } from "./env.js";

describe("parsePortEnv", () => {
  it("returns the fallback when the value is undefined", () => {
    expect(parsePortEnv(undefined, 3000)).toBe(3000);
  });

  it("parses a trimmed integer port within range", () => {
    expect(parsePortEnv(" 4567 ", 3000)).toBe(4567);
    expect(parsePortEnv("1", 3000)).toBe(1);
    expect(parsePortEnv("65535", 3000)).toBe(65535);
  });

  it("rejects non-integer, empty, and out-of-range values", () => {
    for (const value of ["", "0", "65536", "abc", "3.14", "-1"]) {
      expect(() => parsePortEnv(value, 3000)).toThrow(
        `Invalid PORT "${value}": expected an integer from 1 to 65535.`,
      );
    }
  });

  it("names the offending variable in the error when overridden", () => {
    expect(() => parsePortEnv("nope", 3000, "API_PORT")).toThrow(
      `Invalid API_PORT "nope": expected an integer from 1 to 65535.`,
    );
  });
});
