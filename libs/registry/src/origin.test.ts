import { describe, expect, it } from "vitest";
import { REGISTRY_ORIGIN } from "./constants.js";
import { normalizeOrigin } from "./origin.js";

describe("normalizeOrigin", () => {
  it("uses the canonical registry origin by default", () => {
    expect(normalizeOrigin(undefined)).toBe(REGISTRY_ORIGIN);
  });

  it("trims trailing slashes", () => {
    expect(normalizeOrigin("https://example.com/registry///")).toBe("https://example.com/registry");
  });

  it("rejects non-http origins", () => {
    expect(() => normalizeOrigin("ftp://example.com")).toThrow(/must start with http/);
  });
});
