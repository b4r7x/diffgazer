import type { LensId } from "@diffgazer/core/schemas/review";
import { describe, expect, test } from "vitest";
import { isLensSelectionDirty, resolveEffectiveLenses } from "./lens-selection";

const ALL: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

describe("isLensSelectionDirty", () => {
  test("is false when no user choice has been made", () => {
    expect(isLensSelectionDirty(ALL, null)).toBe(false);
  });

  test("is false when selection matches current lenses (same order)", () => {
    expect(isLensSelectionDirty(ALL, [...ALL])).toBe(false);
  });

  test("is false when selection matches current lenses (different order)", () => {
    const reordered: LensId[] = ["tests", "security", "correctness", "performance", "simplicity"];
    expect(isLensSelectionDirty(ALL, reordered)).toBe(false);
  });

  test("is true when a lens is removed", () => {
    const removed: LensId[] = ["correctness", "security", "performance", "simplicity"];
    expect(isLensSelectionDirty(ALL, removed)).toBe(true);
  });

  test("is true when a lens is added", () => {
    const base: LensId[] = ["correctness", "security"];
    const added: LensId[] = ["correctness", "security", "tests"];
    expect(isLensSelectionDirty(base, added)).toBe(true);
  });

  test("is true when selection is cleared", () => {
    expect(isLensSelectionDirty(ALL, [])).toBe(true);
  });

  test("treats a swap (same length, different members) as dirty", () => {
    const current: LensId[] = ["correctness", "security"];
    const swapped: LensId[] = ["correctness", "tests"];
    expect(isLensSelectionDirty(current, swapped)).toBe(true);
  });
});

describe("resolveEffectiveLenses", () => {
  const fallback: LensId[] = ["correctness", "security"];

  test("returns the user choice when one has been made", () => {
    const choice: LensId[] = ["tests"];
    expect(resolveEffectiveLenses(ALL, choice, fallback)).toEqual(choice);
  });

  test("returns persisted default lenses when no user choice and defaults are present", () => {
    expect(resolveEffectiveLenses(ALL, null, fallback)).toEqual(ALL);
  });

  test("returns fallback when no user choice and persisted defaults are empty", () => {
    expect(resolveEffectiveLenses([], null, fallback)).toEqual(fallback);
  });

  test("returns empty selection when the user explicitly cleared selection", () => {
    expect(resolveEffectiveLenses(ALL, [], fallback)).toEqual([]);
  });
});
