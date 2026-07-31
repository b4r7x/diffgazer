import { describe, expect, it } from "vitest";
import { CANDIDATE_VERDICTS, PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { RAW_CATALOG } from "./fixtures.js";
import { transformCatalogObservation } from "./transform.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";

function transform(catalog: unknown = RAW_CATALOG) {
  return transformCatalogObservation({
    source: "models.dev-snapshot",
    checkedAt: CHECKED_AT,
    catalog,
  });
}

describe("transformCatalogObservation", () => {
  it("joins bounded observations through product-registry identities without conferring admission", () => {
    const observations = transform();

    expect(observations.map(({ productId }) => productId)).toEqual([
      "gemini",
      "zai",
      "openrouter",
      "groq",
      "cerebras",
      "mistral",
    ]);

    for (const observation of observations) {
      expect(observation.transportFamily).toBe(
        PRODUCT_REGISTRY[observation.productId].transportFamily,
      );
      expect(observation.source).toBe("models.dev-snapshot");
      expect(observation.checkedAt).toBe(CHECKED_AT);
      expect(Object.keys(observation).sort()).toEqual([
        "checkedAt",
        "models",
        "productId",
        "source",
        "transportFamily",
      ]);

      for (const model of observation.models) {
        expect(
          Object.keys(model).every((key) =>
            ["contextTokens", "modelId", "modelName", "outputTokens", "sourceProviderId"].includes(
              key,
            ),
          ),
        ).toBe(true);
      }
    }

    const serialized = JSON.stringify(observations);
    for (const forbidden of [
      "admitted",
      "api",
      "cost",
      "enabled",
      "env",
      "free",
      "private",
      "ready",
      "selectable",
    ]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });

  it("keeps unknown upstream and wire-compatible records outside product observations", () => {
    const observations = transform({
      google: {
        id: "google",
        models: {
          "upstream/exact:model-1": {
            id: "upstream/exact:model-1",
            name: "Upstream exact model",
          },
        },
      },
      "wire-compatible-clone": {
        id: "wire-compatible-clone",
        api: "https://generativelanguage.googleapis.com/v1beta",
        models: {
          "clone-model": { id: "clone-model", name: "Clone model" },
        },
      },
      "unknown-upstream": {
        id: "unknown-upstream",
        models: {
          "unknown-model": { id: "unknown-model", name: "Unknown model" },
        },
      },
    });

    const gemini = observations.find(({ productId }) => productId === "gemini");
    expect(gemini?.models).toEqual([
      {
        modelId: "upstream/exact:model-1",
        modelName: "Upstream exact model",
        sourceProviderId: "google",
      },
    ]);
    expect(JSON.stringify(observations)).not.toContain("clone-model");
    expect(JSON.stringify(observations)).not.toContain("unknown-model");
    expect(gemini?.models[0]).not.toHaveProperty("selectable");
    expect(gemini?.models[0]).not.toHaveProperty("enabled");
  });

  it("preserves exact model IDs and rejects aliases or mismatches instead of rewriting them", () => {
    const observations = transform({
      google: {
        id: "google",
        models: {
          "provider/exact.model:1": {
            id: "provider/exact.model:1",
            name: "Exact",
            limit: { context: 131072, output: 8192 },
          },
          "provider/model/latest": {
            id: "provider/model/latest",
            name: "Marketing alias",
          },
          mismatch: {
            id: "different-model",
            name: "Mismatched identity",
          },
          hostile: {
            id: "model\u001b[31m",
            name: "Hostile identity",
          },
        },
      },
    });

    const gemini = observations.find(({ productId }) => productId === "gemini");
    expect(gemini?.models).toEqual([
      {
        modelId: "provider/exact.model:1",
        modelName: "Exact",
        sourceProviderId: "google",
        contextTokens: 131072,
        outputTokens: 8192,
      },
    ]);
  });

  it("skips unsafe model labels before they reach product observations", () => {
    const observations = transform({
      google: {
        id: "google",
        models: {
          safe: { id: "safe", name: "Safe model" },
          secret: { id: "secret", name: "apiKey: sk-live-adversarial-secret" },
          path: { id: "path", name: "/usr/local/bin/diffgazer" },
          control: { id: "control", name: "Model\u001b[31m" },
        },
      },
    });

    const gemini = observations.find(({ productId }) => productId === "gemini");
    expect(gemini?.models).toEqual([
      {
        modelId: "safe",
        modelName: "Safe model",
        sourceProviderId: "google",
      },
    ]);
    expect(JSON.stringify(observations)).not.toMatch(/sk-live|\/usr|\\\\build-host/);
  });

  it("keeps excluded and removed identities out of the shared fixture", () => {
    const providerIds = Object.keys(RAW_CATALOG);

    expect(providerIds).toEqual(["google", "zai", "groq", "cerebras", "openrouter", "mistral"]);
    expect(providerIds).not.toContain("zai-coding");
    expect(providerIds).not.toContain("zai-coding-plan");
    expect(providerIds).not.toContain("github-models");
    for (const candidateId of Object.keys(CANDIDATE_VERDICTS)) {
      expect(providerIds, candidateId).not.toContain(candidateId);
    }
    expect(JSON.stringify(RAW_CATALOG)).not.toContain('"enabled":true');
  });
});
