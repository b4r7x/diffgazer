import { describe, expect, it } from "vitest";
import { PROVIDER_DERIVED } from "../catalog/provider-derived.js";
import { BILLING_TIER_BADGES, getBillingTier, offersFreeModels } from "./billing-tier.js";
import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "./product-registry.js";

describe("getBillingTier", () => {
  it("never bills a locally hosted model as paid", () => {
    expect(getBillingTier("ollama")).toBe("local");
    expect(getBillingTier("local-openai")).toBe("local");
  });

  it("reads a CLI that rides an existing subscription as ambient rather than paid", () => {
    expect(getBillingTier("codex-cli")).toBe("ambient");
    expect(getBillingTier("copilot-cli")).toBe("ambient");
  });

  // Two facts, both true: every offerable Gemini model carries a list price, and
  // Google publishes a no-cost quota to run them on. FREE would promise the
  // wrong one and PAID would hide the product's only free on-ramp.
  it("names the declared account tier when every offerable model is priced", () => {
    expect(PRODUCT_REGISTRY.gemini.billing.modes).toContain("free-tier");
    expect(PROVIDER_DERIVED.gemini.billing).toBe("paid");
    expect(getBillingTier("gemini")).toBe("free-tier");
  });

  // Cerebras closed its free tier (2026-08-17); with no zero-priced catalog
  // model and no declared free quota the badge must not promise one, while
  // Ollama Cloud's unpriced quota-billed catalog can say no more than FREE TIER.
  it("does not invent a free tier and names a declared one for an unpriced catalog", () => {
    expect(PRODUCT_REGISTRY.cerebras.billing.modes).toEqual(["pay-as-you-go"]);
    expect(getBillingTier("cerebras")).toBe("paid");
    expect(PROVIDER_DERIVED["ollama-cloud"].billing).toBe("unknown");
    expect(getBillingTier("ollama-cloud")).toBe("free-tier");
  });

  // A zero-priced catalog model outranks the declared account tier: Groq and
  // Mistral publish free models beside priced ones, so the badge names the mix
  // rather than the quota, and Z.AI earns it with no declared free quota at all.
  it("reports a product offering both priced and zero-priced models as mixed", () => {
    for (const productId of ["openrouter", "groq", "mistral", "zai"] as const) {
      expect(PROVIDER_DERIVED[productId].billing, productId).toBe("mixed");
      expect(getBillingTier(productId), productId).toBe("mixed");
      expect(offersFreeModels(getBillingTier(productId)), productId).toBe(true);
    }
    expect(PRODUCT_REGISTRY.zai.billing.modes).toEqual(["pay-as-you-go"]);
  });

  it("stays paid for a pay-as-you-go product that declares no free quota", () => {
    expect(PRODUCT_REGISTRY.deepseek.billing.modes).toEqual(["pay-as-you-go"]);
    expect(getBillingTier("deepseek")).toBe("paid");
    expect(offersFreeModels(getBillingTier("deepseek"))).toBe(false);
  });

  // The one safeguard that costs money if it slips: FREE is a claim about a
  // price, so only a real zero-priced catalog range may ever produce it. A
  // declared account tier can reach FREE TIER and no further.
  it("never lets a registry claim earn the FREE badge", () => {
    for (const productId of SELECTABLE_PRODUCT_IDS) {
      if (PROVIDER_DERIVED[productId].billing === "free") continue;
      expect(getBillingTier(productId), productId).not.toBe("free");
    }
  });
});

describe("offersFreeModels", () => {
  it("counts zero-priced, mixed, and free-tier products as runnable at no cost", () => {
    expect(offersFreeModels("free")).toBe(true);
    expect(offersFreeModels("mixed")).toBe(true);
    expect(offersFreeModels("free-tier")).toBe(true);
    expect(offersFreeModels("paid")).toBe(false);
    expect(offersFreeModels("local")).toBe(false);
  });
});

describe("BILLING_TIER_BADGES", () => {
  it("gives every tier its own badge word so surfaces cannot invent one", () => {
    const labels = Object.values(BILLING_TIER_BADGES).map(({ label }) => label);

    expect(labels).toEqual(["FREE", "PAID", "FREE/PAID", "LOCAL", "AMBIENT", "FREE TIER"]);
    expect(BILLING_TIER_BADGES.free.variant).toBe("success");
    expect(BILLING_TIER_BADGES["free-tier"].variant).toBe("info");
  });
});
