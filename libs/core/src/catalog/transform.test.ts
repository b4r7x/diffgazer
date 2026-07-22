import { describe, expect, it } from "vitest";
import { requireValue } from "../testing/assertions.js";
import { RAW_CATALOG } from "./fixtures.js";
import { PROVIDER_OVERLAY, type ProviderOverlay } from "./provider-overlay.js";
import { parseModelsDevCatalog } from "./schema.js";
import { canRunReview, catalogToModelInfo, findModelLimit, isModelFreeToUse } from "./transform.js";

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
    expect(isModelFreeToUse(byId("gemini-2.5-flash", "gemini"), overlay)).toBe(true);
  });
  it("a priced model whose family is not listed in freeTier.families is paid", () => {
    const overlay: ProviderOverlay = {
      ...PROVIDER_OVERLAY.gemini,
      freeTier: { families: ["gemini-flash"] },
    };
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
    expect(flash.description).toContain("1M context");
    expect(flash.contextLength).toBe(1048576);
    expect(flash.maxOutputTokens).toBe(65536);
    const pro3 = requireValue(
      models.find((m) => m.id === "gemini-3-pro-preview"),
      "Gemini 3 Pro model info",
    );
    expect(pro3.tier).toBe("paid");
    expect(pro3.recommended).toBeUndefined();
  });

  it("filters out the embedding model (output limit below the review floor)", () => {
    const models = catalogToModelInfo(catalog, "gemini");
    expect(models.find((m) => m.id === "gemini-embedding-001")).toBeUndefined();
  });

  it("filters out an audio-output (TTS) model via modalities", () => {
    const models = catalogToModelInfo(catalog, "gemini");
    expect(models.find((m) => m.id === "gemini-2.5-flash-preview-tts")).toBeUndefined();
  });

  it("describes a model's context with the same K label as the capability card", () => {
    const models = catalogToModelInfo(catalog, "groq");
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

  it("keeps the raw model id verbatim while sanitizing only the display label", () => {
    const styledName = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          flash: {
            id: "gemini-2.5-flash",
            name: "Gemini \x1b]8;;https://evil.example\x07Flash\x1b]8;;\x07",
            cost: { input: 1, output: 1 },
            limit: { output: 8192 },
          },
        },
      },
    });
    const [model] = catalogToModelInfo(styledName, "gemini");
    expect(model?.id).toBe("gemini-2.5-flash");
    expect(model?.name).toBe("Gemini Flash");
  });

  it("drops a model whose id needs destructive sanitization instead of mutating its identity", () => {
    const hostile = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          clean: {
            id: "gemini-flash",
            name: "Clean",
            cost: { input: 1, output: 1 },
            limit: { output: 8192 },
          },
          hostile: {
            id: "gemini-\x07flash",
            name: "Hostile",
            cost: { input: 1, output: 1 },
            limit: { output: 8192 },
          },
        },
      },
    });
    const ids = catalogToModelInfo(hostile, "gemini").map((m) => m.id);
    expect(ids).toContain("gemini-flash");
    expect(ids).not.toContain("gemini-\x07flash");
    expect(new Set(ids).size).toBe(ids.length);
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
    expect(catalogToModelInfo(catalog, "gemini").map((m) => m.id)).toEqual(ids);
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
