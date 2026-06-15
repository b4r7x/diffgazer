import { describe, expect, test } from "vitest";
import type { LensId } from "./lens.js";
import {
  ANALYSIS_SETTINGS_SUBTITLE,
  isLensId,
  isLensSelectionDirty,
  resolveEffectiveLenses,
} from "./lens-selection.js";

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

describe("isLensSelectionDirty", () => {
  test("is false when no user choice has been made", () => {
    expect(isLensSelectionDirty(ALL, null)).toBe(false);
  });

  test("is false when selection matches current lenses regardless of order", () => {
    const reordered: LensId[] = ["tests", "security", "correctness", "performance", "simplicity"];
    expect(isLensSelectionDirty(ALL, reordered)).toBe(false);
  });

  test("is true when a lens is removed", () => {
    const removed: LensId[] = ["correctness", "security", "performance", "simplicity"];
    expect(isLensSelectionDirty(ALL, removed)).toBe(true);
  });

  test("is true when selection is cleared", () => {
    expect(isLensSelectionDirty(ALL, [])).toBe(true);
  });
});

describe("ANALYSIS_SETTINGS_SUBTITLE", () => {
  test("uses the lens-neutral vocabulary", () => {
    expect(ANALYSIS_SETTINGS_SUBTITLE).toBe("Choose which lenses run during reviews.");
  });
});
