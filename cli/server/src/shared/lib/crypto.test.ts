import { describe, expect, it } from "vitest";
import { safeTokenMatch } from "./crypto.js";

describe("safeTokenMatch", () => {
  it("returns false when the header is missing", () => {
    expect(safeTokenMatch(undefined, "expected-token")).toBe(false);
  });

  it("returns false when token character lengths differ", () => {
    expect(safeTokenMatch("short", "expected-token")).toBe(false);
  });

  it("returns false instead of throwing when UTF-8 byte lengths differ", () => {
    expect(safeTokenMatch("abé", "abc")).toBe(false);
  });

  it("returns false for a wrong token with the same byte length", () => {
    expect(safeTokenMatch("expected-tokem", "expected-token")).toBe(false);
  });

  it("returns true for the exact token", () => {
    expect(safeTokenMatch("expected-token", "expected-token")).toBe(true);
  });
});
