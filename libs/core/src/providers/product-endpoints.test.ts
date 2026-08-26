import { describe, expect, it } from "vitest";
import { PRODUCT_ENDPOINT_TUPLES } from "./product-endpoints.js";

describe("PRODUCT_ENDPOINT_TUPLES", () => {
  it("names every endpoint with something other than its URL", () => {
    for (const profiles of Object.values(PRODUCT_ENDPOINT_TUPLES)) {
      for (const profile of profiles) {
        expect(profile.label).not.toBe(profile.endpoint);
        expect(profile.label.length).toBeGreaterThan(0);
      }
    }
  });
});
