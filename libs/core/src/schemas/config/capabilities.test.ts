import { describe, it, expect } from "vitest";
import { AVAILABLE_PROVIDERS, PROVIDER_CAPABILITIES, OPENROUTER_PROVIDER_ID } from "./capabilities.js";
import { AI_PROVIDERS } from "./providers.js";

describe("AVAILABLE_PROVIDERS (derived from overlay)", () => {
  it("lists gemini first to preserve the onboarding default", () => {
    expect(AVAILABLE_PROVIDERS[0]?.id).toBe("gemini");
  });

  it("lists only the six enabled providers (no disabled/surfaced providers in the picker)", () => {
    const ids = AVAILABLE_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(["gemini", "zai", "zai-coding", "openrouter", "groq", "cerebras"]);
    for (const surfaced of ["mistral", "huggingface", "github-models"]) {
      expect(ids).not.toContain(surfaced);
    }
  });

  it("carries each enabled provider's default model from the overlay", () => {
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "gemini")?.defaultModel).toBe("gemini-2.5-flash");
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "groq")?.defaultModel).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
  });

  it("resolves the curated displayName override for gemini", () => {
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "gemini")?.name).toBe("Google Gemini");
  });

  it("resolves names from the models.dev snapshot when there is no override", () => {
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "groq")?.name).toBe("Groq");
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "cerebras")?.name).toBe("Cerebras");
  });

  it("keeps OPENROUTER_PROVIDER_ID resolvable", () => {
    expect(OPENROUTER_PROVIDER_ID).toBe("openrouter");
  });
});

describe("PROVIDER_CAPABILITIES (derived from snapshot)", () => {
  it("exposes a capability card for every provider in the enum", () => {
    for (const id of AI_PROVIDERS) {
      const cap = PROVIDER_CAPABILITIES[id];
      expect(cap, `missing capabilities for ${id}`).toBeTruthy();
      expect(typeof cap.toolCalling).toBe("string");
      expect(typeof cap.jsonMode).toBe("string");
      expect(typeof cap.streaming).toBe("string");
      expect(typeof cap.contextWindow).toBe("string");
      expect(["free", "paid", "mixed"]).toContain(cap.tier);
      expect(["FREE", "PAID"]).toContain(cap.tierBadge);
      expect(Array.isArray(cap.capabilities)).toBe(true);
      expect(typeof cap.costDescription).toBe("string");
    }
  });

  it("marks free-tier providers with a FREE badge", () => {
    expect(PROVIDER_CAPABILITIES.gemini.tierBadge).toBe("FREE");
    expect(PROVIDER_CAPABILITIES.groq.tierBadge).toBe("FREE");
    expect(PROVIDER_CAPABILITIES.cerebras.tierBadge).toBe("FREE");
  });

  it("marks zai-coding as paid (no free tier)", () => {
    expect(PROVIDER_CAPABILITIES["zai-coding"].tierBadge).toBe("PAID");
  });
});
