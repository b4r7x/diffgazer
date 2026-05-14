import { describe, expect, it } from "vitest";
import { typeaheadSearch } from "../typeahead.js";

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
  it("returns null for empty items", () => {
    expect(typeaheadSearch({ items: [], query: "a", currentIndex: -1, getLabel })).toBeNull();
  });

  it("returns null for empty query", () => {
    expect(typeaheadSearch({ items: ITEMS, query: "", currentIndex: -1, getLabel })).toBeNull();
  });

  it("matches case-insensitively from the start of label", () => {
    const match = typeaheadSearch({ items: ITEMS, query: "ap", currentIndex: -1, getLabel });
    expect(match?.id).toBe("1");
  });

  it("single-char query starts at currentIndex + 1 (cycle by char)", () => {
    // currentIndex 0 ("Apple"), query "a" -> next item with 'a' is index 2 ("apricot")
    const match = typeaheadSearch({ items: ITEMS, query: "a", currentIndex: 0, getLabel });
    expect(match?.id).toBe("3");
  });

  it("single-char query wraps around list", () => {
    // currentIndex 2 ("apricot"), query "a" -> wrap to index 0 ("Apple")
    const match = typeaheadSearch({ items: ITEMS, query: "a", currentIndex: 2, getLabel });
    expect(match?.id).toBe("1");
  });

  it("cycling repeated char treats it as single-char cycle", () => {
    // query "aaa" should behave like "a"
    const match = typeaheadSearch({ items: ITEMS, query: "aaa", currentIndex: 0, getLabel });
    expect(match?.id).toBe("3");
  });

  it("multi-distinct-char query searches from top, not from currentIndex", () => {
    // currentIndex 4, query "bl" should still find "blueberry" at index 4
    const match = typeaheadSearch({ items: ITEMS, query: "bl", currentIndex: 4, getLabel });
    expect(match?.id).toBe("5");
  });

  it("multi-distinct-char query returns first match from index 0", () => {
    // currentIndex 3, query "ba" -> "Banana" at index 1, not skipped
    const match = typeaheadSearch({ items: ITEMS, query: "ba", currentIndex: 3, getLabel });
    expect(match?.id).toBe("2");
  });

  it("returns null when no item starts with the query", () => {
    const match = typeaheadSearch({ items: ITEMS, query: "z", currentIndex: -1, getLabel });
    expect(match).toBeNull();
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
});
