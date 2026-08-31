import { describe, expect, it } from "vitest";
import { PROVIDER_DERIVED } from "../catalog/provider-derived.js";
import { BILLING_TIER_BADGES, getBillingTier, offersFreeModels } from "./billing-tier.js";
import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "./product-registry.js";

describe("getBillingTier", () => {
  // Two facts, both true: every offerable Gemini model carries a list price, and
  // Google publishes a no-cost quota to run them on. FREE would promise the
  // wrong one and PAID would hide the product's only free on-ramp.
  it("names the declared account tier when every offerable model is priced", () => {
    expect(PRODUCT_REGISTRY.gemini.billing.modes).toContain("free-tier");
    expect(PROVIDER_DERIVED.gemini.billing).toBe("paid");
    expect(getBillingTier("gemini")).toBe("free-tier");
  });

  // Ollama Cloud's unpriced quota-billed catalog can say no more than FREE
  // TIER: with no zero-priced catalog model the badge must not promise FREE.
  it("names a declared free tier for an unpriced catalog without inventing FREE", () => {
    expect(PROVIDER_DERIVED["ollama-cloud"].billing).toBe("unknown");
    expect(getBillingTier("ollama-cloud")).toBe("free-tier");
  });

  // A zero-priced catalog model outranks the declared account tier: OpenRouter
  // publishes free models beside priced ones, so the badge names the mix rather
  // than the quota, and Z.AI earns it with no declared free quota at all.
  it("reports a product offering both priced and zero-priced models as mixed", () => {
    for (const productId of ["openrouter", "zai"] as const) {
      expect(PROVIDER_DERIVED[productId].billing, productId).toBe("mixed");
      expect(getBillingTier(productId), productId).toBe("mixed");
      expect(offersFreeModels(getBillingTier(productId)), productId).toBe(true);
    }
    expect(PRODUCT_REGISTRY.zai.billing.modes).toEqual(["pay-as-you-go"]);
  });

  // A subscription is not a free quota. OpenCode Go buys included usage on the
  // same key as Zen credits, so neither declared mode may promise a no-cost
  // route; the FREE/PAID mix is earned by Zen's zero-priced catalog models
  // (models.dev `opencode`/`opencode-go` sources), not by a registry claim.
  it("does not read a subscription-credit mode as a declared free tier", () => {
    expect(PRODUCT_REGISTRY["opencode-zen"].billing.modes).toEqual([
      "pay-as-you-go",
      "subscription-credit",
    ]);
    expect(PROVIDER_DERIVED["opencode-zen"].billing).toBe("mixed");
    expect(getBillingTier("opencode-zen")).toBe("mixed");
    expect(offersFreeModels(getBillingTier("opencode-zen"))).toBe(true);
  });

  // The one safeguard that costs money if it slips: FREE is a claim about a
  // price, so only a real zero-priced catalog range may ever produce it. A
  // declared account tier can reach FREE QUOTA and no further.
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
  });
});

describe("BILLING_TIER_BADGES", () => {
  it("gives every tier its own badge word so surfaces cannot invent one", () => {
    const labels = Object.values(BILLING_TIER_BADGES).map(({ label }) => label);

    expect(labels).toEqual(["FREE", "PAID", "FREE/PAID", "FREE QUOTA"]);
    expect(BILLING_TIER_BADGES.free.variant).toBe("success");
    expect(BILLING_TIER_BADGES["free-tier"].variant).toBe("info");
  });
});
