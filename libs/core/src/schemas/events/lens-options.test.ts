import { describe, expect, it } from "vitest";
import { SELECTABLE_LENS_IDS } from "../review/lens.js";
import { AGENT_METADATA, LENS_TO_AGENT } from "./agent.js";
import { LENS_OPTIONS } from "./lens-options.js";

describe("LENS_OPTIONS", () => {
  it("never offers the engine-only synthesis lens", () => {
    const offeredIds: readonly string[] = LENS_OPTIONS.map((option) => option.id);
    expect(offeredIds).not.toContain("synthesis");
  });

  it("offers every selectable lens, in order, with its agent's presentation", () => {
    expect(LENS_OPTIONS).toEqual(
      SELECTABLE_LENS_IDS.map((lensId) => {
        const meta = AGENT_METADATA[LENS_TO_AGENT[lensId]];
        return {
          id: lensId,
          label: meta.name,
          badgeLabel: meta.badgeLabel,
          badgeVariant: meta.badgeVariant,
          description: meta.description,
        };
      }),
    );
  });
});
