import { describe, expect, it } from "vitest";
import {
  MAX_ROUTE_SLUG_LENGTH,
  MAX_ROUTE_SLUGS,
  MAX_SEARCH_QUERY_LENGTH,
  normalizeSearchQuery,
  parseDocsPageInput,
  parseDocsShellInput,
  parseLibrarySwitchInput,
  parseSearchQueryInput,
} from "./server-inputs";

describe("docs server input parsing", () => {
  it("accepts known docs library IDs", () => {
    expect(parseDocsShellInput({ library: "ui" })).toEqual({ library: "ui" });
  });

  it("rejects unknown docs library IDs", () => {
    expect(() => parseDocsShellInput({ library: "missing" })).toThrow();
  });

  it("normalizes page route slugs", () => {
    expect(
      parseDocsPageInput({
        library: "keys",
        routeSlugs: [" getting-started ", "installation"],
      }),
    ).toEqual({
      library: "keys",
      routeSlugs: ["getting-started", "installation"],
    });
  });

  it.each([
    { routeSlugs: "installation", label: "non-array slugs" },
    { routeSlugs: ["Installation"], label: "uppercase slugs" },
    { routeSlugs: [""], label: "empty slugs" },
    { routeSlugs: ["has/slash"], label: "slash-containing slugs" },
    {
      routeSlugs: Array.from({ length: MAX_ROUTE_SLUGS + 1 }, () => "a"),
      label: "too many slugs",
    },
    {
      routeSlugs: ["a".repeat(MAX_ROUTE_SLUG_LENGTH + 1)],
      label: "overlong slugs",
    },
  ])("rejects $label", ({ routeSlugs }) => {
    expect(() => parseDocsPageInput({ library: "ui", routeSlugs })).toThrow();
  });

  it("normalizes search queries to the documented maximum length", () => {
    const query = `  ${"a".repeat(MAX_SEARCH_QUERY_LENGTH + 20)}  `;

    expect(parseSearchQueryInput(query)).toHaveLength(MAX_SEARCH_QUERY_LENGTH);
    expect(normalizeSearchQuery(query)).toHaveLength(MAX_SEARCH_QUERY_LENGTH);
  });

  it("rejects non-string search queries", () => {
    expect(() => parseSearchQueryInput({ query: "button" })).toThrow();
  });

  it("accepts normalized library switch input", () => {
    expect(
      parseLibrarySwitchInput({
        targetLibrary: "keys",
        currentSlugs: [" guides ", "navigation"],
      }),
    ).toEqual({
      targetLibrary: "keys",
      currentSlugs: ["guides", "navigation"],
    });
  });

  it("rejects invalid library switch input", () => {
    expect(() =>
      parseLibrarySwitchInput({
        targetLibrary: "missing",
        currentSlugs: ["guides"],
      }),
    ).toThrow();
    expect(() =>
      parseLibrarySwitchInput({
        targetLibrary: "ui",
        currentSlugs: ["BadSlug"],
      }),
    ).toThrow();
  });
});
