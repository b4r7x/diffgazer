import { describe, expect, test } from "vitest";
import type { LensId } from "./lens.js";
import { deriveLensSelectionState, isLensId } from "./lens-selection.js";

const ALL: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

describe("isLensId", () => {
  test("accepts known lens ids", () => {
    expect(isLensId("security")).toBe(true);
  });

  test("rejects unknown values and null", () => {
    expect(isLensId("not-a-lens")).toBe(false);
    expect(isLensId(null)).toBe(false);
  });
});

describe("deriveLensSelectionState", () => {
  const fallback: LensId[] = ["correctness", "security"];

  test("uses the user choice over the persisted defaults", () => {
    const choice: LensId[] = ["tests"];
    expect(deriveLensSelectionState(ALL, choice, fallback)).toEqual({
      effective: choice,
      isDirty: true,
      hasSelection: true,
    });
  });

  test("uses the persisted defaults when the user has not chosen", () => {
    expect(deriveLensSelectionState(ALL, null, fallback)).toEqual({
      effective: ALL,
      isDirty: false,
      hasSelection: true,
    });
  });

  test("is not dirty when a reordered selection holds the same lenses", () => {
    const reordered: LensId[] = ["tests", "security", "correctness", "performance", "simplicity"];
    expect(deriveLensSelectionState(ALL, reordered, fallback).isDirty).toBe(false);
  });

  test("is dirty when a lens is removed from the persisted selection", () => {
    const removed: LensId[] = ["correctness", "security", "performance", "simplicity"];
    expect(deriveLensSelectionState(ALL, removed, fallback).isDirty).toBe(true);
  });

  test("uses fallback lenses without marking an untouched selection dirty", () => {
    expect(deriveLensSelectionState([], null, fallback)).toEqual({
      effective: fallback,
      isDirty: false,
      hasSelection: true,
    });
  });

  test("filters persisted values and detects a changed selection", () => {
    expect(deriveLensSelectionState(["correctness", "not-a-lens"], ["security"], fallback)).toEqual(
      {
        effective: ["security"],
        isDirty: true,
        hasSelection: true,
      },
    );
  });

  test("reports an explicitly empty selection as dirty and invalid", () => {
    expect(deriveLensSelectionState(["correctness"], [], fallback)).toEqual({
      effective: [],
      isDirty: true,
      hasSelection: false,
    });
  });
});
