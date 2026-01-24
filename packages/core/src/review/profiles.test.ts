import { describe, it, expect } from "vitest";
import { PROFILES, PROFILE_LIST, getProfile } from "./profiles.js";
import { ReviewProfileSchema, PROFILE_IDS, LENS_IDS } from "@repo/schemas/lens";

describe("Review Profiles", () => {
  describe("PROFILES registry", () => {
    it("contains all defined profile IDs", () => {
      for (const id of PROFILE_IDS) {
        expect(PROFILES[id].id).toBe(id);
      }
    });

    it("has exactly the expected number of profiles", () => {
      expect(Object.keys(PROFILES)).toHaveLength(PROFILE_IDS.length);
    });
  });

  describe("PROFILE_LIST", () => {
    it("contains all profiles as an array", () => {
      expect(PROFILE_LIST).toHaveLength(PROFILE_IDS.length);
      expect(PROFILE_LIST.map((p) => p.id).sort()).toEqual([...PROFILE_IDS].sort());
    });
  });

  describe("getProfile", () => {
    it.each(PROFILE_IDS)("returns the %s profile", (id) => {
      const profile = getProfile(id);
      expect(profile.id).toBe(id);
      expect(profile.name).not.toBe('');
      expect(profile.description).not.toBe('');
      expect(profile.lenses.length).toBeGreaterThan(0);
    });
  });

  describe("profile schema validation", () => {
    it.each(PROFILE_LIST)("$id profile passes schema validation", (profile) => {
      const result = ReviewProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });
  });

  describe("profile lenses", () => {
    it.each(PROFILE_LIST)("$id profile only references valid lenses", (profile) => {
      for (const lensId of profile.lenses) {
        expect(LENS_IDS).toContain(lensId);
      }
    });
  });

  describe("quick profile", () => {
    it("uses only correctness lens", () => {
      const profile = getProfile("quick");
      expect(profile.lenses).toEqual(["correctness"]);
    });

    it("filters to high severity and above", () => {
      const profile = getProfile("quick");
      expect(profile.filter?.minSeverity).toBe("high");
    });
  });

  describe("strict profile", () => {
    it("uses correctness, security, and tests lenses", () => {
      const profile = getProfile("strict");
      expect(profile.lenses).toEqual(["correctness", "security", "tests"]);
    });

    it("has no severity filter", () => {
      const profile = getProfile("strict");
      expect(profile.filter).toBeUndefined();
    });
  });

  describe("perf profile", () => {
    it("includes performance lens", () => {
      const profile = getProfile("perf");
      expect(profile.lenses).toContain("performance");
    });

    it("includes correctness lens for baseline", () => {
      const profile = getProfile("perf");
      expect(profile.lenses).toContain("correctness");
    });
  });

  describe("security profile", () => {
    it("prioritizes security lens first", () => {
      const profile = getProfile("security");
      expect(profile.lenses[0]).toBe("security");
    });
  });
});
