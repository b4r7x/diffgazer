import { describe, expect, it } from "vitest";
import { resolveApiEndpoint } from "./api-endpoint";

describe("resolveApiEndpoint", () => {
  const fallback = "http://127.0.0.1:3000";

  it("trims and accepts HTTP(S) overrides", () => {
    expect(resolveApiEndpoint("  https://api.example.test/v1  ", fallback)).toBe(
      "https://api.example.test/v1",
    );
  });

  it.each([undefined, "", "   "])("uses the same fallback for %s", (value) => {
    expect(resolveApiEndpoint(value, fallback)).toBe(fallback);
  });

  it("rejects malformed overrides", () => {
    expect(() => resolveApiEndpoint("not a URL", fallback)).toThrow(
      "VITE_API_URL must be a valid HTTP(S) URL.",
    );
  });

  it.each([
    "file:///tmp/api",
    "ftp://api.example.test",
  ])("rejects unsupported endpoint %s", (value) => {
    expect(() => resolveApiEndpoint(value, fallback)).toThrow(
      "VITE_API_URL must use HTTP or HTTPS.",
    );
  });
});
