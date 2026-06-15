import { describe, expect, it } from "vitest";
import { requireValue } from "../testing/assertions.js";
import { RAW_CATALOG } from "./fixtures.js";
import { PROVIDER_OVERLAY, type ProviderOverlay } from "./provider-overlay.js";
import { parseModelsDevCatalog } from "./schema.js";
import {
  canRunReview,
  catalogToModelInfo,
  findModelLimit,
  isModelFreeToUse,
  mergeModelsAcrossSources,
} from "./transform.js";

const catalog = parseModelsDevCatalog(RAW_CATALOG);

const byId = (id: string, provider: keyof typeof PROVIDER_OVERLAY) => {
  const sourceId = requireValue(
    PROVIDER_OVERLAY[provider].modelsDevIds[0],
    `${provider} catalog source id`,
  );
  return requireValue(catalog[sourceId]?.models[id], `${provider} model ${id}`);
};

describe("isModelFreeToUse", () => {
  it("gemini-2.5-flash is free despite a positive sticker price (in freeTier.ids)", () => {
    expect(isModelFreeToUse(byId("gemini-2.5-flash", "gemini"), PROVIDER_OVERLAY.gemini)).toBe(
      true,
    );
  });
  it("gemini-3-pro-preview is paid (priced and NOT in the freeTier selector)", () => {
    expect(isModelFreeToUse(byId("gemini-3-pro-preview", "gemini"), PROVIDER_OVERLAY.gemini)).toBe(
      false,
    );
  });
  it("zai glm-4.7-flash is free (zero list price, no curation needed)", () => {
    expect(isModelFreeToUse(byId("glm-4.7-flash", "zai"), PROVIDER_OVERLAY.zai)).toBe(true);
  });
  it("zai glm-4.7 is paid (priced, no provider selector)", () => {
    expect(isModelFreeToUse(byId("glm-4.7", "zai"), PROVIDER_OVERLAY.zai)).toBe(false);
  });
  it("zai-coding glm-4.7 is paid despite cost 0/0 (hasFreeTier: false)", () => {
    expect(isModelFreeToUse(byId("glm-4.7", "zai-coding"), PROVIDER_OVERLAY["zai-coding"])).toBe(
      false,
    );
  });
  it("groq priced model is free (freeTier: 'all')", () => {
    expect(
      isModelFreeToUse(
        byId("meta-llama/llama-4-scout-17b-16e-instruct", "groq"),
        PROVIDER_OVERLAY.groq,
      ),
    ).toBe(true);
  });
  it("cerebras priced model is free (freeTier: 'all')", () => {
    expect(isModelFreeToUse(byId("gpt-oss-120b", "cerebras"), PROVIDER_OVERLAY.cerebras)).toBe(
      true,
    );
  });

  it("a priced model whose family is in freeTier.families is free", () => {
    const overlay: ProviderOverlay = {
      ...PROVIDER_OVERLAY.gemini,
      freeTier: { families: ["gemini-flash"] },
    };
    // gemini-2.5-flash carries family 'gemini-flash' and a positive price.
    expect(isModelFreeToUse(byId("gemini-2.5-flash", "gemini"), overlay)).toBe(true);
  });
  it("a priced model whose family is not listed in freeTier.families is paid", () => {
    const overlay: ProviderOverlay = {
      ...PROVIDER_OVERLAY.gemini,
      freeTier: { families: ["gemini-flash"] },
    };
    // gemini-2.5-pro carries family 'gemini-pro', absent from the selector.
    expect(isModelFreeToUse(byId("gemini-2.5-pro", "gemini"), overlay)).toBe(false);
  });
});

describe("catalogToModelInfo", () => {
  it("produces ModelInfo with derived tier, name, description, and recommended flag", () => {
    const models = catalogToModelInfo(catalog, "gemini");
    const flash = requireValue(
      models.find((m) => m.id === "gemini-2.5-flash"),
      "Gemini Flash model info",
    );
    expect(flash.tier).toBe("free");
    expect(flash.recommended).toBe(true);
    expect(flash.name).toBe("Gemini 2.5 Flash");
    expect(flash.description.length).toBeGreaterThan(0);
    // Description context label uses the same M/K formatting as the capability
    // card (formatContextTokens), so the two never disagree on one number.
    expect(flash.description).toContain("1M context");
    const pro3 = requireValue(
      models.find((m) => m.id === "gemini-3-pro-preview"),
      "Gemini 3 Pro model info",
    );
    expect(pro3.tier).toBe("paid");
    expect(pro3.recommended).toBeUndefined();
  });

  it("filters out the embedding model (output limit below the review floor)", () => {
    const models = catalogToModelInfo(catalog, "gemini");
    // gemini-embedding-001 has limit.output 1 — it can never emit a review object,
    // so it must not appear in the picker data.
    expect(models.find((m) => m.id === "gemini-embedding-001")).toBeUndefined();
  });

  it("filters out an audio-output (TTS) model via modalities", () => {
    const models = catalogToModelInfo(catalog, "gemini");
    // gemini-2.5-flash-preview-tts has a usable output limit but outputs audio.
    expect(models.find((m) => m.id === "gemini-2.5-flash-preview-tts")).toBeUndefined();
  });

  it("describes a model's context with the same K label as the capability card", () => {
    const models = catalogToModelInfo(catalog, "groq");
    // groq's llama model has a 131072 context => '131K context.', not an M label.
    const llama = requireValue(
      models.find((m) => m.id === "meta-llama/llama-4-scout-17b-16e-instruct"),
      "Groq Llama model info",
    );
    expect(llama.description).toContain("131K context");
  });

  it("omits the context suffix for a model with no usable context window", () => {
    const noContext = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "gemini-2.5-flash": {
            id: "gemini-2.5-flash",
            name: "Bare Flash",
            cost: { input: 1, output: 1 },
          },
        },
      },
    });
    const [model] = catalogToModelInfo(noContext, "gemini");
    expect(model?.description).toBe("Bare Flash");
  });

  it("falls back to the model id for name and description when name is absent", () => {
    const noName = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "gemini-2.5-flash": { id: "gemini-2.5-flash", cost: { input: 1, output: 1 } },
        },
      },
    });
    const [model] = catalogToModelInfo(noName, "gemini");
    expect(model?.name).toBe("gemini-2.5-flash");
    expect(model?.description).toBe("gemini-2.5-flash");
  });

  it("orders Gemini free-first, then deterministically by name (pinned overlay order)", () => {
    const ids = catalogToModelInfo(catalog, "gemini").map((m) => m.id);
    const freeIds = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];
    const paidIds = ["gemini-3-pro-preview"];
    expect(new Set(ids.slice(0, 3))).toEqual(new Set(freeIds));
    for (const free of freeIds) {
      for (const paid of paidIds) {
        expect(ids.indexOf(free)).toBeLessThan(ids.indexOf(paid));
      }
    }
    // Ordering is stable across runs (deterministic).
    expect(catalogToModelInfo(catalog, "gemini").map((m) => m.id)).toEqual(ids);
  });

  it("merges by id across alias modelsDevIds, keeping the freshest last_updated entry", () => {
    // Two source providers carry the same model id; the newer last_updated wins.
    // Exercises the REAL merge the transform uses, not a re-implementation.
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Old Name",
            cost: { input: 1, output: 1 },
            last_updated: "2024-01-01",
          },
          "google-only": {
            id: "google-only",
            name: "Google Only",
            cost: { input: 1, output: 1 },
            last_updated: "2024-06-01",
          },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "New Name",
            cost: { input: 2, output: 2 },
            last_updated: "2025-12-01",
          },
          "extra-only": {
            id: "extra-only",
            name: "Extra Only",
            cost: { input: 3, output: 3 },
            last_updated: "2025-01-01",
          },
        },
      },
    });

    const merged = mergeModelsAcrossSources(aliased, ["google", "google-extra"]);
    const byId = new Map(merged.map((m) => [m.id, m]));

    // Duplicate id collapses to the freshest entry across both source providers.
    expect(byId.get("dup-model")?.name).toBe("New Name");
    expect(byId.get("dup-model")?.last_updated).toBe("2025-12-01");
    // Non-duplicate ids from each source survive untouched.
    expect(byId.get("google-only")?.name).toBe("Google Only");
    expect(byId.get("extra-only")?.name).toBe("Extra Only");
    expect(merged).toHaveLength(3);
  });

  it("ranks a real last_updated above an entry carrying only a newer release_date", () => {
    // A model with an authoritative last_updated must win over a same-id entry
    // whose only date is release_date, even when that release_date string is later.
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Has last_updated",
            cost: { input: 1, output: 1 },
            last_updated: "2025-12-01",
          },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Release only",
            cost: { input: 2, output: 2 },
            release_date: "2026-01-01",
          },
        },
      },
    });

    const merged = mergeModelsAcrossSources(aliased, ["google", "google-extra"]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Has last_updated");
  });

  it("falls back to release_date when no entry carries last_updated, newest winning", () => {
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Older release",
            cost: { input: 1, output: 1 },
            release_date: "2024-01-01",
          },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": {
            id: "dup-model",
            name: "Newer release",
            cost: { input: 2, output: 2 },
            release_date: "2025-06-01",
          },
        },
      },
    });

    const merged = mergeModelsAcrossSources(aliased, ["google", "google-extra"]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Newer release");
  });

  it("keeps the first-seen entry when neither duplicate carries any date", () => {
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": { id: "dup-model", name: "First seen", cost: { input: 1, output: 1 } },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": { id: "dup-model", name: "Second seen", cost: { input: 2, output: 2 } },
        },
      },
    });

    const merged = mergeModelsAcrossSources(aliased, ["google", "google-extra"]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("First seen");
  });
});

describe("canRunReview", () => {
  it("keeps a text-output model with a usable output limit", () => {
    expect(canRunReview({ id: "x", limit: { context: 131072, output: 8192 } })).toBe(true);
  });

  it("rejects an audio-output model regardless of its output limit", () => {
    expect(
      canRunReview({
        id: "tts",
        limit: { context: 8192, output: 16384 },
        modalities: { input: ["text"], output: ["audio"] },
      }),
    ).toBe(false);
  });

  it("rejects a model whose output limit is below the review floor", () => {
    expect(canRunReview({ id: "embedding", limit: { context: 2048, output: 1 } })).toBe(false);
    expect(canRunReview({ id: "guard", limit: { context: 512, output: 512 } })).toBe(false);
  });

  it("keeps a model with no declared limit or modalities (cannot prove it unusable)", () => {
    expect(canRunReview({ id: "unknown" })).toBe(true);
  });
});

describe("findModelLimit", () => {
  it("resolves the output and context limits for a selected model", () => {
    expect(findModelLimit(catalog, "groq", "meta-llama/llama-4-scout-17b-16e-instruct")).toEqual({
      context: 131072,
      output: 8192,
    });
  });

  it("returns an empty object for an unknown model id", () => {
    expect(findModelLimit(catalog, "gemini", "no-such-model")).toEqual({});
  });
});
