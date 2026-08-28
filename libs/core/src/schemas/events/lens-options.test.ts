import { describe, expect, it } from "vitest";
import { SELECTABLE_LENS_IDS } from "../review/lens.js";
import { LENS_OPTIONS } from "./lens-options.js";

describe("LENS_OPTIONS", () => {
  it("never offers the engine-only synthesis lens", () => {
    const offeredIds: readonly string[] = LENS_OPTIONS.map((option) => option.id);
    expect(offeredIds).not.toContain("synthesis");
  });

  it("offers every selectable lens, in order, with its agent's presentation", () => {
    expect(LENS_OPTIONS.map((option) => option.id)).toEqual([...SELECTABLE_LENS_IDS]);
    expect(LENS_OPTIONS[0]).toEqual({
      id: "correctness",
      label: "Detective",
      badgeLabel: "DET",
      badgeVariant: "info",
      description: "Finds bugs and logic errors",
    });
    expect(LENS_OPTIONS[1]).toEqual({
      id: "security",
      label: "Guardian",
      badgeLabel: "SEC",
      badgeVariant: "warning",
      description: "Identifies security vulnerabilities",
    });
  });
});
