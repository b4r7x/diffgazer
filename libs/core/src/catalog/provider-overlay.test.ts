import { describe, it, expect } from "vitest";
import { AI_PROVIDERS } from "@diffgazer/core/schemas/config";
import { PROVIDER_OVERLAY, SURFACED_OVERLAYS } from "./provider-overlay.js";

describe("PROVIDER_OVERLAY", () => {
  it("has exactly one row per AIProvider enum member (exhaustive)", () => {
    expect(Object.keys(PROVIDER_OVERLAY).sort()).toEqual([...AI_PROVIDERS].sort());
  });

  it("maps gemini -> ['google'] with GOOGLE_API_KEY and curated free-tier ids", () => {
    const o = PROVIDER_OVERLAY.gemini;
    expect(o.modelsDevIds).toEqual(["google"]);
    expect(o.diffgazerEnvVar).toBe("GOOGLE_API_KEY");
    expect(o.displayName).toBe("Google Gemini");
    expect(o.hasFreeTier).toBe(true);
    expect(o.freeTier).toEqual({
      ids: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    });
    expect(o.defaultModel).toBe("gemini-2.5-flash");
    expect(o.recommendedModelId).toBe("gemini-2.5-flash");
    expect(o.sdkKind).toBe("google");
    expect(o.enabled).toBe(true);
  });

  it("only gemini carries a curated displayName override (others derive from models.dev)", () => {
    expect(PROVIDER_OVERLAY.gemini.displayName).toBe("Google Gemini");
    for (const [id, o] of Object.entries(PROVIDER_OVERLAY)) {
      if (id === "gemini") continue;
      expect(o.displayName, `${id} should derive its name from models.dev`).toBeUndefined();
    }
  });

  it("keeps zai on ZAI_API_KEY (never models.dev's ZHIPU_API_KEY) with no free selector", () => {
    const o = PROVIDER_OVERLAY.zai;
    expect(o.modelsDevIds).toEqual(["zai"]);
    expect(o.diffgazerEnvVar).toBe("ZAI_API_KEY");
    expect(o.hasFreeTier).toBe(true);
    expect(o.freeTier).toBeUndefined();
    expect(o.sdkKind).toBe("zhipu");
    expect(o.baseURL).toBe("https://api.z.ai/api/paas/v4");
  });

  it("maps zai-coding -> ['zai-coding-plan'] with hasFreeTier false and the coding baseURL", () => {
    const o = PROVIDER_OVERLAY["zai-coding"];
    expect(o.modelsDevIds).toEqual(["zai-coding-plan"]);
    expect(o.diffgazerEnvVar).toBe("ZAI_API_KEY");
    expect(o.hasFreeTier).toBe(false);
    expect(o.freeTier).toBeUndefined();
    expect(o.sdkKind).toBe("zhipu");
    expect(o.baseURL).toBe("https://api.z.ai/api/coding/paas/v4");
  });

  it("keeps openrouter on its own live path (enabled, openrouter sdkKind)", () => {
    const o = PROVIDER_OVERLAY.openrouter;
    expect(o.modelsDevIds).toEqual(["openrouter"]);
    expect(o.diffgazerEnvVar).toBe("OPENROUTER_API_KEY");
    expect(o.sdkKind).toBe("openrouter");
    expect(o.enabled).toBe(true);
  });

  it("enables groq with freeTier 'all' and the scout default model", () => {
    const o = PROVIDER_OVERLAY.groq;
    expect(o.modelsDevIds).toEqual(["groq"]);
    expect(o.diffgazerEnvVar).toBe("GROQ_API_KEY");
    expect(o.hasFreeTier).toBe(true);
    expect(o.freeTier).toBe("all");
    expect(o.defaultModel).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    expect(o.sdkKind).toBe("openai-compatible");
    expect(o.baseURL).toBe("https://api.groq.com/openai/v1");
    expect(o.enabled).toBe(true);
  });

  it("enables cerebras with freeTier 'all', gpt-oss-120b default, and a free-tier note", () => {
    const o = PROVIDER_OVERLAY.cerebras;
    expect(o.modelsDevIds).toEqual(["cerebras"]);
    expect(o.diffgazerEnvVar).toBe("CEREBRAS_API_KEY");
    expect(o.hasFreeTier).toBe(true);
    expect(o.freeTier).toBe("all");
    expect(o.defaultModel).toBe("gpt-oss-120b");
    expect(o.sdkKind).toBe("openai-compatible");
    expect(o.baseURL).toBe("https://api.cerebras.ai/v1");
    expect(o.freeTierNote).toContain("1M");
    expect(o.enabled).toBe(true);
  });
});

describe("SURFACED_OVERLAYS (data-only, not AIProvider members)", () => {
  it("surfaces mistral, huggingface, github-models as disabled", () => {
    expect(Object.keys(SURFACED_OVERLAYS).sort()).toEqual(
      ["github-models", "huggingface", "mistral"].sort(),
    );
    for (const row of Object.values(SURFACED_OVERLAYS)) {
      expect(row.enabled).toBe(false);
    }
    expect(SURFACED_OVERLAYS.mistral!.diffgazerEnvVar).toBe("MISTRAL_API_KEY");
    expect(SURFACED_OVERLAYS.huggingface!.diffgazerEnvVar).toBe("HF_TOKEN");
    expect(SURFACED_OVERLAYS["github-models"]!.diffgazerEnvVar).toBe("GITHUB_TOKEN");
  });
});
