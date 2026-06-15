import type { ModelInfo } from "../schemas/config/models.js";
import type { AIProvider } from "../schemas/config/providers.js";
import { formatContextTokens } from "./format.js";
import { PROVIDER_OVERLAY, type ProviderOverlay } from "./provider-overlay.js";
import type { ModelsDevCatalog, ModelsDevModel } from "./schema.js";

type PricingTier = "free" | "paid" | "unknown";

/**
 * Minimum `limit.output` a model needs to emit a structured review object. Below
 * this floor live only embedding (output 1) and prompt-guard (output 512) models;
 * the smallest real review-capable chat model sits an order of magnitude above it.
 */
const REVIEW_OUTPUT_FLOOR = 1024;

/** Derived from the models.dev sticker price only. Absent cost => 'unknown'. */
function pricingTierOf(model: ModelsDevModel): PricingTier {
  if (!model.cost) return "unknown";
  return model.cost.input === 0 && model.cost.output === 0 ? "free" : "paid";
}

/**
 * True when a model can actually produce a review. Excludes audio-output models
 * (TTS) via `modalities.output` and embedding/guard models via the output floor —
 * both data the snapshot/live catalog already carry. The live catalog tags audio
 * output; the offline snapshot strips modalities, so the output floor stays the
 * load-bearing guard there.
 */
export function canRunReview(model: ModelsDevModel): boolean {
  const outputModalities = model.modalities?.output;
  if (outputModalities && !outputModalities.includes("text")) return false;
  const outputLimit = model.limit?.output;
  if (outputLimit !== undefined && outputLimit < REVIEW_OUTPUT_FLOOR) return false;
  return true;
}

/**
 * Resolve a selected model's documented token limits from a merged catalog, so a
 * request budget can be clamped to what the provider accepts. Returns an empty
 * object when the model is absent (the caller falls back to its default budget).
 */
export function findModelLimit(
  catalog: ModelsDevCatalog,
  provider: AIProvider,
  modelId: string,
): { output?: number; context?: number } {
  const overlay = PROVIDER_OVERLAY[provider];
  const model = mergeModelsAcrossSources(catalog, overlay.modelsDevIds).find(
    (entry) => entry.id === modelId,
  );
  if (!model?.limit) return {};
  return { output: model.limit.output, context: model.limit.context };
}

function matchesSelector(model: ModelsDevModel, overlay: ProviderOverlay): boolean {
  const selector = overlay.freeTier;
  if (!selector || selector === "all") return false;
  if (selector.ids?.includes(model.id)) return true;
  if (model.family && selector.families?.includes(model.family)) return true;
  return false;
}

/**
 * Resolve the public 2-value tier. A provider whose whole plan is paid
 * (hasFreeTier:false) is never free — even a 0/0 sticker price there is a
 * subscription-included price, not a free tier (zai-coding). Otherwise a model
 * is free when it is genuinely zero-priced, OR the provider's whole free quota
 * covers it ('all'), OR it is a priced model the curated selector covers. Priced
 * models not in the selector default to paid — never falsely claiming free.
 */
export function isModelFreeToUse(model: ModelsDevModel, overlay: ProviderOverlay): boolean {
  if (!overlay.hasFreeTier) return false;
  if (pricingTierOf(model) === "free") return true;
  if (overlay.freeTier === "all") return true;
  return matchesSelector(model, overlay);
}

/**
 * Rank a model's freshness as a comparable epoch. `last_updated` is the dominant
 * signal: any model carrying one outranks a model that only has `release_date`,
 * so the two date fields are never compared against each other. Within a tier,
 * the newer timestamp wins; a model with neither date sorts oldest.
 */
function freshnessRank(model: ModelsDevModel): { tier: number; epoch: number } {
  if (model.last_updated) return { tier: 2, epoch: Date.parse(model.last_updated) || 0 };
  if (model.release_date) return { tier: 1, epoch: Date.parse(model.release_date) || 0 };
  return { tier: 0, epoch: 0 };
}

/** True when `candidate` is fresher than `current` (strict; ties keep `current`). */
function isFresher(candidate: ModelsDevModel, current: ModelsDevModel): boolean {
  const a = freshnessRank(candidate);
  const b = freshnessRank(current);
  if (a.tier !== b.tier) return a.tier > b.tier;
  return a.epoch > b.epoch;
}

function describeModel(model: ModelsDevModel): string {
  const context = model.limit?.context;
  if (context && context >= 1000) {
    return `${model.name ?? model.id} — ${formatContextTokens(context)} context.`;
  }
  return model.name ?? model.id;
}

function toModelInfo(model: ModelsDevModel, overlay: ProviderOverlay): ModelInfo {
  const recommended = model.id === overlay.recommendedModelId;
  return {
    id: model.id,
    name: model.name ?? model.id,
    description: describeModel(model),
    tier: isModelFreeToUse(model, overlay) ? "free" : "paid",
    ...(recommended ? { recommended: true } : {}),
  };
}

/**
 * Merge every source provider in `modelsDevIds` into one model list, deduped by
 * the inner `model.id`. Duplicate ids collapse to the freshest entry (see
 * isFresher). Source providers absent from the catalog are skipped.
 */
export function mergeModelsAcrossSources(
  catalog: ModelsDevCatalog,
  modelsDevIds: readonly string[],
): ModelsDevModel[] {
  const merged = new Map<string, ModelsDevModel>();

  for (const sourceId of modelsDevIds) {
    const source = catalog[sourceId];
    if (!source) continue;
    for (const model of Object.values(source.models)) {
      const existing = merged.get(model.id);
      if (!existing || isFresher(model, existing)) {
        merged.set(model.id, model);
      }
    }
  }

  return [...merged.values()];
}

/** Locale-independent code-unit comparison so ordering is identical everywhere. */
function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Merge every source provider in overlay.modelsDevIds into one ModelInfo[].
 * Duplicate ids collapse to the freshest entry. Output is deterministic and
 * locale-independent: free models first, then by name (case-insensitive), id as
 * the final tiebreak.
 */
export function catalogToModelInfo(catalog: ModelsDevCatalog, provider: AIProvider): ModelInfo[] {
  const overlay = PROVIDER_OVERLAY[provider];

  return mergeModelsAcrossSources(catalog, overlay.modelsDevIds)
    .filter(canRunReview)
    .map((model) => toModelInfo(model, overlay))
    .sort((a, b) => {
      const aFree = a.tier === "free" ? 0 : 1;
      const bFree = b.tier === "free" ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      const byName = compareStrings(a.name.toLowerCase(), b.name.toLowerCase());
      if (byName !== 0) return byName;
      return compareStrings(a.id, b.id);
    });
}
