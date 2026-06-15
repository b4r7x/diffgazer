import { describe, expect, it } from "vitest";
import { typeaheadSearch } from "./typeahead";

interface TestItem {
  id: string;
  label: string;
}

const ITEMS: TestItem[] = [
  { id: "1", label: "Apple" },
  { id: "2", label: "Banana" },
  { id: "3", label: "apricot" },
  { id: "4", label: "Cherry" },
  { id: "5", label: "blueberry" },
];

const getLabel = (item: TestItem) => item.label;

describe("typeaheadSearch", () => {
  it.each([
    { scenario: "empty items list", items: [], query: "a", currentIndex: -1 },
    { scenario: "empty query string", items: ITEMS, query: "", currentIndex: -1 },
    { scenario: "no item matches the query", items: ITEMS, query: "z", currentIndex: -1 },
  ])("returns null when $scenario", ({ items, query, currentIndex }) => {
    expect(typeaheadSearch({ items, query, currentIndex, getLabel })).toBeNull();
  });

  it.each([
    {
      scenario: "matches case-insensitively from start of label",
      query: "ap",
      currentIndex: -1,
      expectedId: "1",
    },
    {
      scenario: "single-char query advances past currentIndex (cycle by char)",
      query: "a",
      currentIndex: 0,
      expectedId: "3",
    },
    {
      scenario: "single-char query wraps around list",
      query: "a",
      currentIndex: 2,
      expectedId: "1",
    },
    {
      scenario: "repeated single char behaves like single-char cycle",
      query: "aaa",
      currentIndex: 0,
      expectedId: "3",
    },
    {
      scenario: "multi-distinct-char query searches from top, including currentIndex",
      query: "bl",
      currentIndex: 4,
      expectedId: "5",
    },
    {
      scenario: "multi-distinct-char query returns first match from index 0",
      query: "ba",
      currentIndex: 3,
      expectedId: "2",
    },
  ])("$scenario", ({ query, currentIndex, expectedId }) => {
    const match = typeaheadSearch({ items: ITEMS, query, currentIndex, getLabel });
    expect(match?.id).toBe(expectedId);
  });

  it("uses provided getLabel for label source", () => {
    const tuples: Array<[string, { label: string }]> = [
      ["a", { label: "Alpha" }],
      ["b", { label: "Beta" }],
    ];
    const match = typeaheadSearch({
      items: tuples,
      query: "be",
      currentIndex: -1,
      getLabel: ([, opt]) => opt.label,
    });
    expect(match?.[0]).toBe("b");
  });

  describe("locale-aware lowercasing", () => {
    it("matches Turkish dotted I via default-locale round-trip", () => {
      // "İ".toLocaleLowerCase() === "i̇" — the same string the buffer
      // would emit if the user typed "İ". Both sides must use the locale-aware
      // lowercase for the prefix match to succeed.
      const items = [{ id: "istanbul", label: "İstanbul" }];
      const query = "İ".toLocaleLowerCase();
      const match = typeaheadSearch({
        items,
        query,
        currentIndex: -1,
        getLabel: (item) => item.label,
      });
      expect(match?.id).toBe("istanbul");
    });

    it("matches German ß labels case-insensitively", () => {
      const items = [{ id: "strasse", label: "STRASSE" }];
      const match = typeaheadSearch({
        items,
        query: "strasse",
        currentIndex: -1,
        getLabel: (item) => item.label,
      });
      expect(match?.id).toBe("strasse");
    });

    it("matches composed Unicode (NFC) labels", () => {
      const items = [{ id: "cafe", label: "Café" }];
      const match = typeaheadSearch({
        items,
        query: "café".toLocaleLowerCase(),
        currentIndex: -1,
        getLabel: (item) => item.label,
      });
      expect(match?.id).toBe("cafe");
    });
  });
});
