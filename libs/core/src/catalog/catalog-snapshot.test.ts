import { describe, expect, it } from "vitest";
import type { AIProvider } from "../schemas/config/providers.js";
import { requireValue } from "../testing/assertions.js";
import { CATALOG_SNAPSHOT } from "./catalog-snapshot.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";
import { ModelsDevCatalogSchema } from "./schema.js";
import { catalogToModelInfo } from "./transform.js";

describe("CATALOG_SNAPSHOT", () => {
  it("conforms to ModelsDevCatalogSchema", () => {
    expect(ModelsDevCatalogSchema.safeParse(CATALOG_SNAPSHOT).success).toBe(true);
  });

  it("covers every enabled provider's source ids", () => {
    for (const overlay of Object.values(PROVIDER_OVERLAY)) {
      if (!overlay.enabled) continue;
      // openrouter's list is live-only; its source is bundled solely for the provider name (asserted below).
      if (overlay.sdkKind === "openrouter") continue;
      for (const sourceId of overlay.modelsDevIds) {
        expect(CATALOG_SNAPSHOT[sourceId], `snapshot missing source ${sourceId}`).toBeDefined();
      }
    }
  });

  it("bundles openrouter's provider-level name (resolveProviderDisplayName reads it)", () => {
    expect(CATALOG_SNAPSHOT.openrouter?.name).toBe("OpenRouter");
  });

  it("retains provider-level `name` (the primary display-name source, Decision A)", () => {
    for (const overlay of Object.values(PROVIDER_OVERLAY)) {
      if (!overlay.enabled || overlay.sdkKind === "openrouter") continue;
      const sourceId = requireValue(overlay.modelsDevIds[0], "provider source id");
      expect(CATALOG_SNAPSHOT[sourceId]?.name, `snapshot ${sourceId} must keep name`).toBeTruthy();
    }
  });

  it("includes every enabled provider's default model in its derived list", () => {
    const enabled = (
      Object.entries(PROVIDER_OVERLAY) as [AIProvider, (typeof PROVIDER_OVERLAY)[AIProvider]][]
    ).filter(([, o]) => o.enabled && o.defaultModel && o.sdkKind !== "openrouter");
    for (const [provider, overlay] of enabled) {
      const ids = catalogToModelInfo(CATALOG_SNAPSHOT, provider).map((m) => m.id);
      expect(ids, `${provider} snapshot must include default ${overlay.defaultModel}`).toContain(
        overlay.defaultModel,
      );
    }
  });

  it("excludes audio-only (TTS) models from the derived picker", () => {
    const audioOnlyByProvider: Partial<Record<AIProvider, string[]>> = {
      gemini: ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"],
      groq: ["canopylabs/orpheus-arabic-saudi", "canopylabs/orpheus-v1-english"],
    };
    for (const [provider, forbidden] of Object.entries(audioOnlyByProvider) as [
      AIProvider,
      string[],
    ][]) {
      const ids = catalogToModelInfo(CATALOG_SNAPSHOT, provider).map((m) => m.id);
      for (const id of forbidden) {
        expect(ids, `${provider} picker must exclude audio-only ${id}`).not.toContain(id);
      }
    }
  });

  it("is trimmed to used fields (no modalities/knowledge/cache pricing)", () => {
    for (const provider of Object.values(CATALOG_SNAPSHOT)) {
      for (const [modelId, model] of Object.entries(provider.models)) {
        expect(model, `${modelId} must drop modalities`).not.toHaveProperty("modalities");
        expect(model, `${modelId} must drop knowledge`).not.toHaveProperty("knowledge");
        if (model.cost) {
          expect(model.cost, `${modelId} cost must drop cache_read`).not.toHaveProperty(
            "cache_read",
          );
          expect(model.cost, `${modelId} cost must drop cache_write`).not.toHaveProperty(
            "cache_write",
          );
        }
      }
    }
  });

  it("emits provider and model keys in deterministic sorted order", () => {
    const providerIds = Object.keys(CATALOG_SNAPSHOT);
    expect(providerIds).toEqual([...providerIds].sort());
    for (const provider of Object.values(CATALOG_SNAPSHOT)) {
      const modelIds = Object.keys(provider.models);
      expect(modelIds).toEqual([...modelIds].sort());
    }
  });
});
