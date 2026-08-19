import { describe, expect, it } from "vitest";
import { CANDIDATE_VERDICTS } from "../providers/candidate-verdicts.js";
import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "../providers/product-registry.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";

describe("catalog provider observations", () => {
  it("leaves exact 14-product eligibility with the product registry", () => {
    expect(SELECTABLE_PRODUCT_IDS).toEqual([
      "gemini",
      "zai",
      "openrouter",
      "groq",
      "cerebras",
      "deepseek",
      "qwen",
      "moonshot",
      "mistral",
      "ollama-cloud",
      "ollama",
      "local-openai",
      "codex-cli",
      "copilot-cli",
    ]);
    expect(SELECTABLE_PRODUCT_IDS).toEqual(
      Object.values(PRODUCT_REGISTRY)
        .filter((product) => product.kind === "runnable")
        .map((product) => product.id),
    );
    expect(Object.keys(PROVIDER_OVERLAY)).toEqual([
      "gemini",
      "zai",
      "openrouter",
      "groq",
      "cerebras",
      "mistral",
      "deepseek",
      "qwen",
      "moonshot",
      "ollama-cloud",
    ]);
  });

  it("keeps the overlay observational and unable to enable products or models", () => {
    for (const overlay of Object.values(PROVIDER_OVERLAY)) {
      for (const key of Object.keys(overlay ?? {})) {
        expect(["modelsDevIds", "nameSourceIds"]).toContain(key);
      }
      expect(overlay).not.toHaveProperty("enabled");
      expect(overlay).not.toHaveProperty("selectable");
      expect(overlay).not.toHaveProperty("models");
    }
  });

  it("keeps name-lending sources disjoint from the observation sources", () => {
    const observationSourceIds = new Set(
      Object.values(PROVIDER_OVERLAY).flatMap((overlay) => [...(overlay?.modelsDevIds ?? [])]),
    );
    expect(PROVIDER_OVERLAY.zai?.nameSourceIds).toEqual(["zai-coding-plan", "zhipuai-coding-plan"]);
    for (const overlay of Object.values(PROVIDER_OVERLAY)) {
      for (const sourceId of overlay?.nameSourceIds ?? []) {
        expect(observationSourceIds.has(sourceId), sourceId).toBe(false);
      }
    }
  });

  it("excludes candidate IDs from the overlay", () => {
    const overlaidIds = new Set([
      ...Object.keys(PROVIDER_OVERLAY),
      ...Object.values(PROVIDER_OVERLAY).flatMap((overlay) => [...(overlay?.modelsDevIds ?? [])]),
    ]);

    expect(overlaidIds.has("github-models")).toBe(false);
    expect(overlaidIds.has("huggingface")).toBe(false);
    for (const candidateId of Object.keys(CANDIDATE_VERDICTS)) {
      expect(overlaidIds.has(candidateId), candidateId).toBe(false);
    }
  });
});
