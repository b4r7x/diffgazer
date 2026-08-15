import { describe, expect, it } from "vitest";
import { LocalOpenAIPresetIdSchema } from "../schemas/config/transports.js";
import { PRODUCT_ENDPOINT_TUPLES } from "./product-endpoints.js";

describe("PRODUCT_ENDPOINT_TUPLES", () => {
  it("keeps every local-openai preset id spellable by the schema that stores it", () => {
    for (const profile of PRODUCT_ENDPOINT_TUPLES["local-openai"]) {
      expect(LocalOpenAIPresetIdSchema.safeParse(profile.id).success).toBe(true);
    }
  });

  it("names every endpoint with something other than its URL", () => {
    for (const profiles of Object.values(PRODUCT_ENDPOINT_TUPLES)) {
      for (const profile of profiles) {
        expect(profile.label).not.toBe(profile.endpoint);
        expect(profile.label.length).toBeGreaterThan(0);
      }
    }
  });
});
