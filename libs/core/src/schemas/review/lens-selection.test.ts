import { describe, expect, test } from "vitest";
import type { SelectableLensId } from "./lens.js";
import { deriveLensSelectionState, isSelectableLensId } from "./lens-selection.js";

const ALL: SelectableLensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

describe("isSelectableLensId", () => {
  test("accepts known lens ids", () => {
    expect(isSelectableLensId("security")).toBe(true);
  });

  test("rejects unknown values and null", () => {
    expect(isSelectableLensId("not-a-lens")).toBe(false);
    expect(isSelectableLensId(null)).toBe(false);
  });

  test("rejects the engine-only synthesis lens", () => {
    expect(isSelectableLensId("synthesis")).toBe(false);
  });
});

describe("deriveLensSelectionState", () => {
  const fallback: SelectableLensId[] = ["correctness", "security"];

  test("uses the user choice over the persisted defaults", () => {
    const choice: SelectableLensId[] = ["tests"];
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
    const reordered: SelectableLensId[] = [
      "tests",
      "security",
      "correctness",
      "performance",
      "simplicity",
    ];
    expect(deriveLensSelectionState(ALL, reordered, fallback).isDirty).toBe(false);
  });

  test("is dirty when a lens is removed from the persisted selection", () => {
    const removed: SelectableLensId[] = ["correctness", "security", "performance", "simplicity"];
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

  test("drops a persisted synthesis entry instead of offering it as a selection", () => {
    expect(
      deriveLensSelectionState(["correctness", "synthesis"], null, fallback).effective,
    ).toEqual(["correctness"]);
  });

  test("reports an explicitly empty selection as dirty and invalid", () => {
    expect(deriveLensSelectionState(["correctness"], [], fallback)).toEqual({
      effective: [],
      isDirty: true,
      hasSelection: false,
    });
  });
});
