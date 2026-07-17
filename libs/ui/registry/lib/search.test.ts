import { describe, expect, it, vi } from "vitest";
import { matchesSearch } from "./search";

describe("matchesSearch", () => {
  it.each([
    { scenario: "empty query matches anything", value: "Apple", query: "", expected: true },
    { scenario: "case-insensitive substring match", value: "Banana", query: "NAN", expected: true },
    { scenario: "non-matching query returns false", value: "Apple", query: "z", expected: false },
  ])("$scenario", ({ value, query, expected }) => {
    expect(matchesSearch(value, query)).toBe(expected);
  });

  describe("Unicode-aware case folding", () => {
    it("round-trips Turkish dotted I between value and query", () => {
      expect(matchesSearch("İstanbul", "İ")).toBe(true);
      expect(matchesSearch("İstanbul", "İstan")).toBe(true);
    });

    it("matches ordinary ASCII I independently of the host locale", () => {
      const toLocaleUpperCase = String.prototype.toLocaleUpperCase;
      const localeSpy = vi
        .spyOn(String.prototype, "toLocaleUpperCase")
        .mockImplementation(function (this: string) {
          return toLocaleUpperCase.call(this, "tr");
        });

      try {
        expect(matchesSearch("input", "INPUT")).toBe(true);
        expect(matchesSearch("INPUT", "input")).toBe(true);
      } finally {
        localeSpy.mockRestore();
      }
    });

    it("expands German sharp S when matching ordinary uppercase text", () => {
      expect(matchesSearch("Straße", "STRASSE")).toBe(true);
      expect(matchesSearch("STRASSE", "Straße")).toBe(true);
    });

    it("matches composed Unicode (NFC) values", () => {
      expect(matchesSearch("Café", "café")).toBe(true);
      expect(matchesSearch("CAFÉ", "é")).toBe(true);
      expect(matchesSearch("Cafe\u0301", "CAFÉ")).toBe(true);
    });
  });
});
