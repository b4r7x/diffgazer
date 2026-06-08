import { describe, expect, it } from "vitest";
import { clampIndex, moveHighlight } from "./list-navigation.js";

describe("clampIndex", () => {
  it("clamps at the upper bound without wrap", () => {
    expect(clampIndex(2, 1, 3, false)).toBe(2);
  });

  it("clamps at the lower bound without wrap", () => {
    expect(clampIndex(0, -1, 3, false)).toBe(0);
  });

  it("wraps from the last to the first index", () => {
    expect(clampIndex(2, 1, 3, true)).toBe(0);
  });

  it("wraps from the first to the last index", () => {
    expect(clampIndex(0, -1, 3, true)).toBe(2);
  });

  it("returns 0 when length is zero", () => {
    expect(clampIndex(0, 1, 0, true)).toBe(0);
    expect(clampIndex(0, -1, 0, false)).toBe(0);
  });

  it("steps forward inside the range", () => {
    expect(clampIndex(1, 1, 4, false)).toBe(2);
  });

  it("steps backward inside the range", () => {
    expect(clampIndex(2, -1, 4, true)).toBe(1);
  });
});

const items = (
  entries: Array<string | { id: string; disabled?: boolean }>,
): Array<{ id: string; disabled: boolean }> =>
  entries.map((entry) =>
    typeof entry === "string"
      ? { id: entry, disabled: false }
      : { ...entry, disabled: entry.disabled ?? false },
  );

describe("moveHighlight", () => {
  it("moves to the next enabled item and skips disabled entries", () => {
    const result = moveHighlight(items(["a", { id: "b", disabled: true }, "c"]), "a", 1, true);
    expect(result).toEqual({ index: 2, id: "c", hitBoundary: false });
  });

  it("returns the first enabled item when the current id is missing", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "missing", 1, false);
    expect(result).toEqual({ index: 0, id: "a", hitBoundary: false });
  });

  it("returns the last enabled item when the current id is missing and wrapping backward", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "missing", -1, true);
    expect(result).toEqual({ index: 2, id: "c", hitBoundary: false });
  });

  it("reports a boundary when the current item cannot move forward without wrapping", () => {
    const result = moveHighlight(items(["a", "b", "c"]), "c", 1, false);
    expect(result).toEqual({ index: 2, id: "c", hitBoundary: true });
  });

  it("reports a boundary when a disabled tail leaves no enabled item ahead", () => {
    const result = moveHighlight(items(["a", { id: "b", disabled: true }]), "a", 1, false);
    expect(result).toEqual({ index: 0, id: "a", hitBoundary: true });
  });

  it("returns null when every item is disabled", () => {
    const result = moveHighlight(
      items([
        { id: "a", disabled: true },
        { id: "b", disabled: true },
      ]),
      "a",
      1,
      true,
    );
    expect(result).toBeNull();
  });
});
