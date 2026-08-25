import { describe, expect, it } from "vitest";
import { LENS_IDS, SELECTABLE_LENS_IDS } from "./enums.js";
import { ReviewMetadataSchema } from "./storage.js";

describe("LENS_IDS", () => {
  it("carries the engine-only synthesis lens", () => {
    expect(LENS_IDS).toContain("synthesis");
  });

  it("keeps synthesis out of the lenses a user can select", () => {
    expect(SELECTABLE_LENS_IDS).not.toContain("synthesis");
    expect([...LENS_IDS]).toEqual([...SELECTABLE_LENS_IDS, "synthesis"]);
  });

  it("still loads a saved run recorded before synthesis existed", () => {
    const parsed = ReviewMetadataSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      projectPath: "/home/user/project",
      createdAt: "2025-01-15T10:00:00Z",
      mode: "unstaged",
      branch: "main",
      profile: null,
      lenses: [...SELECTABLE_LENS_IDS],
      issueCount: 0,
      fileCount: 1,
    });

    expect(parsed.lenses).toEqual([...SELECTABLE_LENS_IDS]);
  });
});
