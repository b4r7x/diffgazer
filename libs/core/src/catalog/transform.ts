import { sanitizeTerminalText } from "../review/sanitize-terminal.js";
import type { ModelInfo } from "../schemas/config/models.js";
import type { AIProvider } from "../schemas/config/providers.js";
import { formatContextTokens } from "./format.js";
import { PROVIDER_OVERLAY, type ProviderOverlay } from "./provider-overlay.js";
import type { ModelsDevCatalog, ModelsDevModel } from "./schema.js";

type PricingTier = "free" | "paid" | "unknown";

// Min limit.output to emit a review object; below it sit only embedding (1) and guard (512) models.
const REVIEW_OUTPUT_FLOOR = 1024;

function pricingTierOf(model: ModelsDevModel): PricingTier {
  if (!model.cost) return "unknown";
  return model.cost.input === 0 && model.cost.output === 0 ? "free" : "paid";
}

/** True when a model can produce a review: excludes audio-output (TTS) via modalities and embedding/guard models via the output floor. */
export function canRunReview(model: ModelsDevModel): boolean {
  const outputModalities = model.modalities?.output;
  if (outputModalities && !outputModalities.includes("text")) return false;
  const outputLimit = model.limit?.output;
  if (outputLimit !== undefined && outputLimit < REVIEW_OUTPUT_FLOOR) return false;
  return true;
}

/** A selected model's documented token limits from the merged catalog; empty object when the model is absent. */
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
 * Public 2-value tier. hasFreeTier:false is never free — a 0/0 price there is
 * subscription-included, not a free tier (zai-coding). Otherwise free when
 * zero-priced, OR freeTier 'all', OR covered by the curated selector; else paid.
 */
export function isModelFreeToUse(model: ModelsDevModel, overlay: ProviderOverlay): boolean {
  if (!overlay.hasFreeTier) return false;
  if (pricingTierOf(model) === "free") return true;
  if (overlay.freeTier === "all") return true;
  return matchesSelector(model, overlay);
}

/**
 * Freshness as a comparable (tier, epoch): any last_updated outranks a
 * release_date-only entry, so the two date fields are never compared against
 * each other. Newer wins within a tier; neither date sorts oldest.
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

/**
 * A model id is a persisted/API identity and the picker's selection key — it MUST
 * survive verbatim. Sanitizing it could collapse two distinct ids into one, so an
 * id that sanitization would alter is rejected rather than mutated.
 */
function hasDisplaySafeId(model: ModelsDevModel): boolean {
  return sanitizeTerminalText(model.id) === model.id;
}

function toModelInfo(model: ModelsDevModel, overlay: ProviderOverlay): ModelInfo {
  const recommended = model.id === overlay.recommendedModelId;
  return {
    id: model.id,
    name: sanitizeTerminalText(model.name ?? model.id),
    description: sanitizeTerminalText(describeModel(model)),
    tier: isModelFreeToUse(model, overlay) ? "free" : "paid",
    ...(recommended ? { recommended: true } : {}),
    ...(model.limit?.context ? { contextLength: model.limit.context } : {}),
    ...(model.limit?.output ? { maxOutputTokens: model.limit.output } : {}),
  };
}

/** Merge every source provider in `modelsDevIds` into one list, deduped by `model.id`; duplicates collapse to the freshest (see isFresher). Missing sources are skipped. */
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

/** Merge overlay.modelsDevIds into a deterministic ModelInfo[]: free first, then by name (case-insensitive), id as the final tiebreak. */
export function catalogToModelInfo(catalog: ModelsDevCatalog, provider: AIProvider): ModelInfo[] {
  const overlay = PROVIDER_OVERLAY[provider];

  return mergeModelsAcrossSources(catalog, overlay.modelsDevIds)
    .filter(canRunReview)
    .filter(hasDisplaySafeId)
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
