import { describe, expect, it } from "vitest";
import { REMOVED_PRODUCT_ID } from "../schemas/config/providers.js";
import { BILLING_TIER_BADGES, getBillingTier } from "./billing-tier.js";

describe("getBillingTier", () => {
  it("never bills a locally hosted model as paid", () => {
    expect(getBillingTier("ollama")).toBe("local");
    expect(getBillingTier("local-openai")).toBe("local");
  });

  it("reads a CLI that rides an existing subscription as ambient rather than paid", () => {
    expect(getBillingTier("codex-cli")).toBe("ambient");
  });

  it("classifies hosted products by their declared billing modes", () => {
    expect(getBillingTier("gemini")).toBe("free");
    expect(getBillingTier("zai")).toBe("paid");
  });

  it("treats a removed record as the hosted product it was", () => {
    expect(getBillingTier(REMOVED_PRODUCT_ID)).toBe("paid");
  });
});

describe("BILLING_TIER_BADGES", () => {
  it("gives every tier its own badge word so surfaces cannot invent one", () => {
    const labels = Object.values(BILLING_TIER_BADGES).map(({ label }) => label);

    expect(labels).toEqual(["FREE", "PAID", "LOCAL", "AMBIENT"]);
    expect(BILLING_TIER_BADGES.free.variant).toBe("success");
  });
});
