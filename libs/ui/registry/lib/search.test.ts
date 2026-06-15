import { describe, expect, it } from "vitest";
import { matchesSearch } from "./search";

describe("matchesSearch", () => {
  it.each([
    { scenario: "empty query matches anything", value: "Apple", query: "", expected: true },
    { scenario: "case-insensitive substring match", value: "Banana", query: "NAN", expected: true },
    { scenario: "non-matching query returns false", value: "Apple", query: "z", expected: false },
  ])("$scenario", ({ value, query, expected }) => {
    expect(matchesSearch(value, query)).toBe(expected);
  });

  describe("locale-aware lowercasing", () => {
    it("round-trips Turkish dotted I between value and query", () => {
      // Default-locale toLocaleLowerCase("İ") === "i̇" (i + combining dot).
      // Both arguments must use the same lowercasing rule for the substring
      // check to succeed.
      expect(matchesSearch("İstanbul", "İ")).toBe(true);
      expect(matchesSearch("İstanbul", "İstan")).toBe(true);
    });

    it("matches German ß labels case-insensitively", () => {
      expect(matchesSearch("STRASSE", "strasse")).toBe(true);
      expect(matchesSearch("Strasse", "STRASSE")).toBe(true);
    });

    it("matches composed Unicode (NFC) values", () => {
      expect(matchesSearch("Café", "café")).toBe(true);
      expect(matchesSearch("CAFÉ", "é")).toBe(true);
    });
  });
});
