import { describe, it, expect } from "vitest";
import { groupBy, chunk, unique, uniqueBy } from "./array.js";

describe("groupBy", () => {
  it("groups items by string key", () => {
    const items = [
      { name: "Alice", role: "admin" },
      { name: "Bob", role: "user" },
      { name: "Charlie", role: "admin" },
    ];

    const grouped = groupBy(items, (item) => item.role);

    expect(grouped).toEqual({
      admin: [
        { name: "Alice", role: "admin" },
        { name: "Charlie", role: "admin" },
      ],
      user: [{ name: "Bob", role: "user" }],
    });
  });

  it("groups items by numeric key", () => {
    const items = [
      { value: 10, category: 1 },
      { value: 20, category: 2 },
      { value: 30, category: 1 },
    ];

    const grouped = groupBy(items, (item) => item.category);

    expect(grouped).toEqual({
      1: [
        { value: 10, category: 1 },
        { value: 30, category: 1 },
      ],
      2: [{ value: 20, category: 2 }],
    });
  });

  it("handles empty array", () => {
    const result = groupBy([], (item: { key: string }) => item.key);
    expect(result).toEqual({});
  });

  it("creates single group when all items have same key", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const grouped = groupBy(items, () => "all");
    expect(grouped).toEqual({
      all: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
  });
});

describe("chunk", () => {
  it("splits array into chunks of specified size", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    expect(chunk(arr, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("handles array length divisible by chunk size", () => {
    const arr = [1, 2, 3, 4, 5, 6];
    expect(chunk(arr, 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it("handles chunk size larger than array", () => {
    const arr = [1, 2, 3];
    expect(chunk(arr, 10)).toEqual([[1, 2, 3]]);
  });

  it("handles empty array", () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it("handles chunk size of 1", () => {
    const arr = [1, 2, 3];
    expect(chunk(arr, 1)).toEqual([[1], [2], [3]]);
  });

  it("handles strings in array", () => {
    const arr = ["a", "b", "c", "d", "e"];
    expect(chunk(arr, 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });
});

describe("unique", () => {
  it("removes duplicate primitive values", () => {
    expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    expect(unique(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("preserves order of first occurrence", () => {
    expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
  });

  it("handles empty array", () => {
    expect(unique([])).toEqual([]);
  });

  it("handles array with no duplicates", () => {
    expect(unique([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("handles mixed types", () => {
    expect(unique([1, "1", 2, "2", 1, "1"])).toEqual([1, "1", 2, "2"]);
  });

  it("does not deduplicate objects by value", () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 1 };
    expect(unique([obj1, obj2])).toEqual([obj1, obj2]);
  });

  it("deduplicates same object references", () => {
    const obj = { id: 1 };
    expect(unique([obj, obj, obj])).toEqual([obj]);
  });
});

describe("uniqueBy", () => {
  it("removes duplicates by key function", () => {
    const items = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 1, name: "Alice Clone" },
    ];

    const result = uniqueBy(items, (item) => item.id);

    expect(result).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
  });

  it("keeps first occurrence when duplicates found", () => {
    const items = [
      { key: "a", value: 1 },
      { key: "b", value: 2 },
      { key: "a", value: 3 },
      { key: "a", value: 4 },
    ];

    const result = uniqueBy(items, (item) => item.key);

    expect(result).toEqual([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
  });

  it("handles empty array", () => {
    const result = uniqueBy([], (item: { id: number }) => item.id);
    expect(result).toEqual([]);
  });

  it("handles array with no duplicates", () => {
    const items = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Charlie" },
    ];

    const result = uniqueBy(items, (item) => item.id);
    expect(result).toEqual(items);
  });

  it("works with complex key functions", () => {
    const items = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 1, y: 2 },
      { x: 5, y: 6 },
    ];

    const result = uniqueBy(items, (item) => `${item.x}-${item.y}`);

    expect(result).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
    ]);
  });

  it("works with null/undefined keys", () => {
    const items = [{ id: null }, { id: undefined }, { id: null }, { id: 1 }];

    const result = uniqueBy(items, (item) => item.id);

    expect(result).toEqual([{ id: null }, { id: undefined }, { id: 1 }]);
  });
});
