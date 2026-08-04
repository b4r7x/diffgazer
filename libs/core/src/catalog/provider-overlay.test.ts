import { describe, expect, it } from "vitest";
import {
  CANDIDATE_VERDICTS,
  PRODUCT_REGISTRY,
  SELECTABLE_PRODUCT_IDS,
} from "../providers/product-registry.js";
import { PROVIDER_OVERLAY, projectCatalogAvailabilityObservations } from "./provider-overlay.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";

describe("catalog provider observations", () => {
  it("leaves exact 13-product eligibility with the product registry", () => {
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
    ]);
  });

  it("keeps offline catalog data observational and unable to enable products or models", () => {
    const observations = projectCatalogAvailabilityObservations("models.dev-snapshot", CHECKED_AT);

    expect(observations).toHaveLength(6);
    for (const observation of observations) {
      expect(observation).toEqual({
        productId: observation.productId,
        modelsDevIds: observation.modelsDevIds,
        source: "models.dev-snapshot",
        checkedAt: CHECKED_AT,
      });
      expect(observation).not.toHaveProperty("enabled");
      expect(observation).not.toHaveProperty("selectable");
      expect(observation).not.toHaveProperty("models");
    }
  });

  it("excludes candidate IDs from availability projections", () => {
    const observations = projectCatalogAvailabilityObservations("models.dev-live", CHECKED_AT);
    const projectedIds = new Set([
      ...observations.map((observation) => observation.productId),
      ...observations.flatMap((observation) => observation.modelsDevIds),
    ]);

    expect(projectedIds.has("github-models")).toBe(false);
    expect(projectedIds.has("huggingface")).toBe(false);
    for (const candidateId of Object.keys(CANDIDATE_VERDICTS)) {
      expect(projectedIds.has(candidateId), candidateId).toBe(false);
    }
  });
});
