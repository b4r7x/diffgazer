import { describe, expect, expectTypeOf, it } from "vitest";
import { CANDIDATE_VERDICTS } from "../providers/candidate-verdicts.js";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { RAW_CATALOG } from "./fixtures.js";
import {
  CatalogSelectableModelIdSchema,
  type ModelsDevCatalog,
  parseModelsDevCatalog,
} from "./schema.js";
import {
  type CatalogModelObservation,
  isOfferableObservation,
  transformCatalogObservation,
  withholdsDeclaredStructuredOutputRefusal,
} from "./transform.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";

// RAW_CATALOG mirrors the live API body, so it crosses the ingestion boundary
// the same way production does before the transform ever sees it.
function transform(catalog: ModelsDevCatalog = parseModelsDevCatalog(RAW_CATALOG)) {
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
      "ollama-cloud",
      "openrouter",
      "opencode-zen",
      "deepseek",
      "zai",
      "qwen",
      "minimax",
      "moonshot",
      "gemini",
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
            [
              "billing",
              "contextTokens",
              "modelId",
              "modelName",
              "outputTokens",
              "releaseDate",
              "sourceProviderId",
              "structuredOutput",
            ].includes(key),
          ),
        ).toBe(true);
      }
    }

    const serialized = JSON.stringify(observations);
    for (const forbidden of ["admitted", "enabled", "private", "ready", "selectable"]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
    // `billing` restates the catalog's published price, so "free" is a legitimate
    // value here; the raw upstream keys behind it still must not ride along.
    for (const upstreamKey of ["api", "cost", "env"]) {
      expect(serialized).not.toContain(`"${upstreamKey}":`);
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
        billing: "unknown",
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
            cost: { input: 0.3, output: 2.5 },
            structured_output: true,
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
        structuredOutput: true,
        billing: "paid",
        contextTokens: 131072,
        outputTokens: 8192,
      },
    ]);
  });

  it("treats non-positive token limits as absent instead of forwarding them", () => {
    const observations = transform({
      google: {
        id: "google",
        models: {
          "whisper-large-v3": {
            id: "whisper-large-v3",
            name: "Whisper Large V3",
            limit: { context: 0, output: 0 },
          },
          "llama-3.3-70b-versatile": {
            id: "llama-3.3-70b-versatile",
            name: "Llama 3.3 70B Versatile",
            limit: { context: 131072, output: 32768 },
          },
        },
      },
    });

    const gemini = observations.find(({ productId }) => productId === "gemini");
    expect(gemini?.models).toEqual([
      {
        modelId: "llama-3.3-70b-versatile",
        modelName: "Llama 3.3 70B Versatile",
        sourceProviderId: "google",
        billing: "unknown",
        contextTokens: 131072,
        outputTokens: 32768,
      },
      {
        modelId: "whisper-large-v3",
        modelName: "Whisper Large V3",
        sourceProviderId: "google",
        billing: "unknown",
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
        billing: "unknown",
      },
    ]);
    expect(JSON.stringify(observations)).not.toMatch(/sk-live|\/usr|\\\\build-host/);
  });

  it("carries the catalog's own structured-output declaration and pricing onto every observation", () => {
    const byId = new Map(
      transform()
        .flatMap(({ models }) => models)
        .map((model) => [String(model.modelId), model]),
    );

    expect(byId.get("gemini-2.5-flash")).toMatchObject({
      structuredOutput: true,
      billing: "paid",
      releaseDate: "2025-03-20",
    });
    // Zero-priced upstream with no structured-output declaration: the
    // observation states neither true nor false rather than guessing.
    expect(byId.get("glm-4.7-flash")).toMatchObject({ billing: "free" });
    expect(byId.get("glm-4.7-flash")).not.toHaveProperty("structuredOutput");
    expect(byId.get("gemini-embedding-001")).toMatchObject({ billing: "unknown" });
  });

  it("offers every text model the product's own model policy admits", () => {
    const observations = transform(
      parseModelsDevCatalog({
        openrouter: {
          id: "openrouter",
          models: {
            "openai/gpt-4o": {
              id: "openai/gpt-4o",
              name: "GPT-4o",
              cost: { input: 2.5, output: 10 },
              structured_output: true,
            },
            // Zero-priced and a pinned identity: ':free' is a separately
            // priced catalog entry, so the picker must offer it.
            "openai/gpt-oss-20b:free": {
              id: "openai/gpt-oss-20b:free",
              name: "gpt-oss-20b (free)",
              cost: { input: 0, output: 0 },
            },
            // Equally zero-priced, but a genuine router: nothing pins which
            // downstream model a review would actually run on.
            "openrouter/free": {
              id: "openrouter/free",
              name: "Free Models Router",
              cost: { input: 0, output: 0 },
              structured_output: true,
            },
          },
        },
      }),
    );

    const openrouter = observations.find(({ productId }) => productId === "openrouter");
    const offered = (openrouter?.models ?? []).filter((model) =>
      isOfferableObservation("openrouter", model),
    );

    expect(openrouter?.models.map(({ modelId }) => String(modelId))).toEqual([
      "openai/gpt-4o",
      "openai/gpt-oss-20b:free",
      "openrouter/free",
    ]);
    expect(offered.map(({ modelId }) => String(modelId))).toEqual([
      "openai/gpt-4o",
      "openai/gpt-oss-20b:free",
    ]);
    expect(offered.some(({ billing }) => billing === "free")).toBe(true);
  });

  it("offers a policy-admitted model whose structured output the catalog never states", () => {
    const observations = transform();
    const zai = observations.find(({ productId }) => productId === "zai");
    const undeclared = zai?.models.find(({ modelId }) => String(modelId) === "glm-4.7");

    expect(undeclared).not.toHaveProperty("structuredOutput");
    expect(undeclared && isOfferableObservation("zai", undeclared)).toBe(true);
  });

  it("offers Z.AI's free -flash models", () => {
    const zai = transform().find(({ productId }) => productId === "zai");
    const offered = (zai?.models ?? [])
      .filter((model) => isOfferableObservation("zai", model))
      .map(({ modelId }) => String(modelId));

    expect(offered).toEqual(["glm-4.7", "glm-4.7-flash"]);
  });

  it("hides a declared structured-output refusal only from strict-json-schema products", () => {
    const observations = transform(
      parseModelsDevCatalog({
        google: {
          id: "google",
          models: {
            refused: { id: "refused", name: "Refused", structured_output: false },
          },
        },
        zai: {
          id: "zai",
          models: {
            refused: { id: "refused", name: "Refused", structured_output: false },
          },
        },
      }),
    );

    const gemini = observations.find(({ productId }) => productId === "gemini");
    const zai = observations.find(({ productId }) => productId === "zai");
    expect(PRODUCT_REGISTRY.gemini.admission.structuredOutput).toBe("strict-json-schema");
    expect(PRODUCT_REGISTRY.zai.admission.structuredOutput).toBe("json-object-local-validation");
    expect(gemini?.models[0] && isOfferableObservation("gemini", gemini.models[0])).toBe(false);
    expect(zai?.models[0] && isOfferableObservation("zai", zai.models[0])).toBe(true);
  });

  // OpenRouter is strict-json-schema too, but every route is pinned and the
  // gateway drops an unsupported response_format instead of rejecting the
  // request; local validation is the quality gate there, so a declared
  // refusal must not hide the route from the picker.
  it("offers a declared structured-output refusal on a pinned-downstream-route product", () => {
    const observations = transform(
      parseModelsDevCatalog({
        openrouter: {
          id: "openrouter",
          models: {
            "stealth/ox-alpha": {
              id: "stealth/ox-alpha",
              name: "Ox Alpha",
              cost: { input: 0, output: 0 },
              structured_output: false,
            },
          },
        },
      }),
    );

    const openrouter = observations.find(({ productId }) => productId === "openrouter");
    const oxAlpha = openrouter?.models.find(
      ({ modelId }) => String(modelId) === "stealth/ox-alpha",
    );
    expect(PRODUCT_REGISTRY.openrouter.admission.structuredOutput).toBe("strict-json-schema");
    expect(oxAlpha).toMatchObject({ structuredOutput: false, billing: "free" });
    expect(oxAlpha && isOfferableObservation("openrouter", oxAlpha)).toBe(true);
  });

  // OpenCode Zen unions two models.dev sources (`opencode`, `opencode-go`)
  // whose catalogs overlap: the first source's row must win an overlapping id
  // so the Zen pay-as-you-go price — the default endpoint's price — is the one
  // the picker shows, while ids only one source knows still union in.
  it("keeps the first source's observation when overlay sources share a model id", () => {
    const observations = transform(
      parseModelsDevCatalog({
        opencode: {
          id: "opencode",
          models: {
            "deepseek-v4-flash": {
              id: "deepseek-v4-flash",
              name: "DeepSeek V4 Flash",
              cost: { input: 0.14, output: 0.28 },
            },
            "big-pickle": {
              id: "big-pickle",
              name: "Big Pickle",
              cost: { input: 0, output: 0 },
            },
          },
        },
        "opencode-go": {
          id: "opencode-go",
          models: {
            "deepseek-v4-flash": {
              id: "deepseek-v4-flash",
              name: "DeepSeek V4 Flash",
              cost: { input: 0.22, output: 0.66 },
            },
            "glm-5.3": {
              id: "glm-5.3",
              name: "GLM 5.3",
              cost: { input: 0.6, output: 2.2 },
            },
          },
        },
      }),
    );

    const zen = observations.find(({ productId }) => productId === "opencode-zen");
    expect(zen?.models).toEqual([
      {
        modelId: "big-pickle",
        modelName: "Big Pickle",
        sourceProviderId: "opencode",
        billing: "free",
      },
      {
        modelId: "deepseek-v4-flash",
        modelName: "DeepSeek V4 Flash",
        sourceProviderId: "opencode",
        billing: "paid",
      },
      {
        modelId: "glm-5.3",
        modelName: "GLM 5.3",
        sourceProviderId: "opencode-go",
        billing: "paid",
      },
    ]);
  });

  it("withholds declared refusals only for strict-schema products without pinned routes", () => {
    expect(withholdsDeclaredStructuredOutputRefusal("gemini")).toBe(true);
    expect(withholdsDeclaredStructuredOutputRefusal("openrouter")).toBe(false);
    expect(withholdsDeclaredStructuredOutputRefusal("zai")).toBe(false);
  });

  it("never observes a model that cannot emit text even when it declares structured output", () => {
    const observations = transform(
      parseModelsDevCatalog({
        google: {
          id: "google",
          models: {
            "tts-only": {
              id: "tts-only",
              name: "Speech Only",
              structured_output: true,
              modalities: { output: ["audio"] },
            },
            // Image-generation model: text rides along in the output, but no
            // structured-output claim backs a schema-constrained review.
            "text-and-image": {
              id: "text-and-image",
              name: "Text and image",
              modalities: { output: ["text", "image"] },
            },
            "text-and-image-structured": {
              id: "text-and-image-structured",
              name: "Text and image, structured",
              structured_output: true,
              modalities: { output: ["text", "image"] },
            },
            "text-only": {
              id: "text-only",
              name: "Text only",
              modalities: { output: ["text"] },
            },
          },
        },
      }),
    );

    const gemini = observations.find(({ productId }) => productId === "gemini");
    expect(gemini?.models.map(({ modelId }) => String(modelId))).toEqual([
      "text-and-image-structured",
      "text-only",
    ]);
  });

  it("admits only a parsed model ID into an observation, never a bare string", () => {
    const modelId = CatalogSelectableModelIdSchema.parse("gemini-2.5-flash");
    expectTypeOf(modelId).toEqualTypeOf<CatalogModelObservation["modelId"]>();
    expectTypeOf<CatalogModelObservation["modelId"]>().not.toEqualTypeOf<string>();

    const unparsed: string = "gemini-2.5-flash";
    // @ts-expect-error an unparsed string never passed CatalogSelectableModelIdSchema
    const forged: CatalogModelObservation["modelId"] = unparsed;

    expect(forged).toBe(modelId);
  });

  it("keeps excluded identities out of the shared fixture", () => {
    const providerIds = Object.keys(RAW_CATALOG);

    expect(providerIds).toEqual(["google", "zai", "openrouter"]);
    expect(providerIds).not.toContain("github-models");
    for (const candidateId of Object.keys(CANDIDATE_VERDICTS)) {
      expect(providerIds, candidateId).not.toContain(candidateId);
    }
    expect(JSON.stringify(RAW_CATALOG)).not.toContain('"enabled":true');
  });
});
