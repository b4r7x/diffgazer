import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { LensId } from "@diffgazer/core/schemas/review";
import { isLensSelectionDirty, resolveEffectiveLenses } from "./lens-selection.js";

const ALL: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

describe("isLensSelectionDirty", () => {
  test("is false when no user choice has been made", () => {
    assert.equal(isLensSelectionDirty(ALL, null), false);
  });

  test("is false when selection matches current lenses (same order)", () => {
    assert.equal(isLensSelectionDirty(ALL, [...ALL]), false);
  });

  test("is false when selection matches current lenses (different order)", () => {
    const reordered: LensId[] = ["tests", "security", "correctness", "performance", "simplicity"];
    assert.equal(isLensSelectionDirty(ALL, reordered), false);
  });

  test("is true when a lens is removed", () => {
    const removed: LensId[] = ["correctness", "security", "performance", "simplicity"];
    assert.equal(isLensSelectionDirty(ALL, removed), true);
  });

  test("is true when a lens is added", () => {
    const base: LensId[] = ["correctness", "security"];
    const added: LensId[] = ["correctness", "security", "tests"];
    assert.equal(isLensSelectionDirty(base, added), true);
  });

  test("is true when selection is cleared", () => {
    assert.equal(isLensSelectionDirty(ALL, []), true);
  });

  test("treats a swap (same length, different members) as dirty", () => {
    const current: LensId[] = ["correctness", "security"];
    const swapped: LensId[] = ["correctness", "tests"];
    assert.equal(isLensSelectionDirty(current, swapped), true);
  });
});

describe("resolveEffectiveLenses", () => {
  const fallback: LensId[] = ["correctness", "security"];

  test("returns the user choice when one has been made", () => {
    const choice: LensId[] = ["tests"];
    assert.deepEqual(resolveEffectiveLenses(ALL, choice, fallback), choice);
  });

  test("returns persisted default lenses when no user choice and defaults are present", () => {
    assert.deepEqual(resolveEffectiveLenses(ALL, null, fallback), ALL);
  });

  test("returns fallback when no user choice and persisted defaults are empty", () => {
    assert.deepEqual(resolveEffectiveLenses([], null, fallback), fallback);
  });

  test("returns empty selection when the user explicitly cleared selection", () => {
    assert.deepEqual(resolveEffectiveLenses(ALL, [], fallback), []);
  });
});
