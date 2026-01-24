import { describe, it, expect } from "vitest";
import { LENSES, LENS_LIST, getLens, getLenses } from "./index.js";
import { LensSchema, LENS_IDS } from "@repo/schemas/lens";

describe("Lenses", () => {
  describe("LENSES registry", () => {
    it("contains all defined lens IDs", () => {
      for (const id of LENS_IDS) {
        expect(LENSES[id]).toBeDefined();
        expect(LENSES[id].id).toBe(id);
      }
    });

    it("has exactly the expected number of lenses", () => {
      expect(Object.keys(LENSES)).toHaveLength(LENS_IDS.length);
    });
  });

  describe("LENS_LIST", () => {
    it("contains all lenses as an array", () => {
      expect(LENS_LIST).toHaveLength(LENS_IDS.length);
      expect(LENS_LIST.map((l) => l.id).sort()).toEqual([...LENS_IDS].sort());
    });
  });

  describe("getLens", () => {
    it.each(LENS_IDS)("returns the %s lens", (id) => {
      const lens = getLens(id);
      expect(lens.id).toBe(id);
      expect(lens.name).toBeTruthy();
      expect(lens.description).toBeTruthy();
      expect(lens.systemPrompt).toBeTruthy();
    });
  });

  describe("getLenses", () => {
    it("returns multiple lenses in order", () => {
      const lenses = getLenses(["security", "correctness"]);
      expect(lenses).toHaveLength(2);
      expect(lenses[0]!.id).toBe("security");
      expect(lenses[1]!.id).toBe("correctness");
    });

    it("returns empty array for empty input", () => {
      const lenses = getLenses([]);
      expect(lenses).toEqual([]);
    });
  });

  describe("lens schema validation", () => {
    it.each(LENS_LIST)("$id lens passes schema validation", (lens) => {
      const result = LensSchema.safeParse(lens);
      expect(result.success).toBe(true);
    });
  });

  describe("lens content requirements", () => {
    it.each(LENS_LIST)("$id lens has security instructions in prompt", (lens) => {
      expect(lens.systemPrompt).toContain("IMPORTANT SECURITY INSTRUCTIONS");
      expect(lens.systemPrompt).toContain("<code-diff>");
    });

    it.each(LENS_LIST)("$id lens has all severity rubric levels", (lens) => {
      expect(lens.severityRubric.blocker).toBeTruthy();
      expect(lens.severityRubric.high).toBeTruthy();
      expect(lens.severityRubric.medium).toBeTruthy();
      expect(lens.severityRubric.low).toBeTruthy();
      expect(lens.severityRubric.nit).toBeTruthy();
    });
  });
});
