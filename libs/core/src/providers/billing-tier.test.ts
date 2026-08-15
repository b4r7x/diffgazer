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

    expect(getBillingTier("groq")).toBe("free-tier");
    expect(getBillingTier("cerebras")).toBe("free-tier");
  });

  // Mistral declares `evaluation` rather than `free-tier`, and its own notice
  // calls that free use evaluation/prototyping — the same quota claim under a
  // different word, so it earns the same badge.
  it("treats a declared evaluation quota as a free tier", () => {
    expect(PRODUCT_REGISTRY.mistral.billing.modes).toContain("evaluation");
    expect(getBillingTier("mistral")).toBe("free-tier");
  });

  it("reports OpenRouter as mixed because it offers both priced and zero-priced models", () => {
    expect(PROVIDER_DERIVED.openrouter.billing).toBe("mixed");
    expect(getBillingTier("openrouter")).toBe("mixed");
    expect(offersFreeModels(getBillingTier("openrouter"))).toBe(true);
  });

  it("stays paid for a pay-as-you-go product that declares no free quota", () => {
    expect(PRODUCT_REGISTRY.zai.billing.modes).toEqual(["pay-as-you-go"]);
    expect(getBillingTier("zai")).toBe("paid");
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
