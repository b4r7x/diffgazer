import { test, describe, expect } from "vitest";
import { moveHighlight } from "./highlight-navigation.js";

const items = (
  ids: string[],
): { id: string; disabled: boolean }[] => ids.map((id) => ({ id, disabled: false }));

describe("moveHighlight", () => {
  test("moves forward to next selectable id", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "a", 1, true);
    expect(result).toEqual({ index: 1, id: "b", hitBoundary: false });
  });

  test("moves backward to previous selectable id", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "c", -1, true);
    expect(result).toEqual({ index: 1, id: "b", hitBoundary: false });
  });

  test("wraps from end to start when wrap=true", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "c", 1, true);
    expect(result).toEqual({ index: 0, id: "a", hitBoundary: false });
  });

  test("flags hitBoundary at end when wrap=false", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "c", 1, false);
    expect(result).toEqual({ index: 2, id: "c", hitBoundary: true });
  });

  test("flags hitBoundary at start when wrap=false", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "a", -1, false);
    expect(result).toEqual({ index: 0, id: "a", hitBoundary: true });
  });

  test("skips disabled items by relying on the selectable-list contract", () => {
    const selectable = [
      { id: "a", disabled: false },
      { id: "c", disabled: false },
    ];
    const result = moveHighlight(selectable, "a", 1, true);
    expect(result).toEqual({ index: 1, id: "c", hitBoundary: false });
  });

  test("returns null for empty list", () => {
    expect(moveHighlight([], "x", 1, true)).toBe(null);
  });

  test("falls back to first item when current is unknown moving forward", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "missing", 1, false);
    expect(result).toEqual({ index: 0, id: "a", hitBoundary: false });
  });

  test("single-item list reports hitBoundary on every move when wrap=false", () => {
    const forward = moveHighlight(items(["solo"]), "solo", 1, false);
    const backward = moveHighlight(items(["solo"]), "solo", -1, false);
    expect(forward).toEqual({ index: 0, id: "solo", hitBoundary: true });
    expect(backward).toEqual({ index: 0, id: "solo", hitBoundary: true });
  });

  test("single-item list with wrap=true stays on the same item without flagging boundary", () => {
    const result = moveHighlight(items(["solo"]), "solo", 1, true);
    expect(result).toEqual({ index: 0, id: "solo", hitBoundary: false });
  });
});
