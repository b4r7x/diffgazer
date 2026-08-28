import {
  type CatalogObservationSource,
  isOfferableObservation,
  type ModelsDevCatalog,
  PROVIDER_OVERLAY,
  transformCatalogObservation,
  withholdsDeclaredStructuredOutputRefusal,
} from "@diffgazer/core/catalog";
import { isModelIdAllowedForProduct, LIVE_ONLY_MODEL_DESCRIPTION } from "@diffgazer/core/providers";
import type {
  ModelInfo,
  ProviderModelsResponse,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { log } from "../../log.js";
import type { LiveModel, LiveModelList } from "../live-model-lists.js";

export type CatalogTierSource = "live" | "cache" | "snapshot";

/** The models.dev catalog a request resolved to, and which tier served it. */
export interface CatalogTier {
  readonly catalog: ModelsDevCatalog;
  readonly fetchedAt: string;
  readonly source: CatalogTierSource;
}

export const observationSourceForResult = (source: CatalogTierSource): CatalogObservationSource =>
  source === "snapshot" ? "models.dev-snapshot" : "models.dev-live";

const describeObservation = (contextTokens?: number): string => {
  if (contextTokens === undefined || contextTokens < 1000) return "";
  const thousands = Math.round(contextTokens / 1000);
  if (thousands >= 1000) {
    const millions = (contextTokens / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${millions}M context`;
  }
  return `${thousands}K context`;
};

/**
 * Newest first: dated rows by release date descending, tied dates by id
 * ascending; rows without a date sort after every dated row, keeping their
 * incoming (catalog or provider-list) order — a missing date is never guessed.
 */
const compareModelsNewestFirst = (left: ModelInfo, right: ModelInfo): number => {
  if (left.releaseDate === undefined && right.releaseDate === undefined) return 0;
  if (left.releaseDate === undefined) return 1;
  if (right.releaseDate === undefined) return -1;
  if (left.releaseDate !== right.releaseDate) return left.releaseDate < right.releaseDate ? 1 : -1;
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
};

/**
 * Map bounded product observations to picker rows without conferring admission
 * or billing. Only models the product's model policy admits — and, where
 * `withholdsDeclaredStructuredOutputRefusal` holds, not published as unable to
 * return structured output — are offered, and the tier repeats the catalog's own per-model price
 * rather than a curated free-quota guess. Applying the policy here — not only
 * at the API boundary — is what lets
 * a product whose whole offering is filtered away report an honest empty
 * discovery instead of a silently blank picker.
 */
export const modelInfoFromBoundedObservation = (
  catalog: ModelsDevCatalog,
  productId: RunnableProductId,
  observationSource: CatalogObservationSource,
  checkedAt: string,
): ModelInfo[] => {
  const observations = transformCatalogObservation({
    source: observationSource,
    checkedAt,
    catalog,
  });
  const productObservation = observations.find(
    (observation) => observation.productId === productId,
  );
  if (!productObservation) return [];

  return productObservation.models
    .filter((model) => isOfferableObservation(productId, model))
    .map((model) => ({
      id: model.modelId,
      name: model.modelName,
      description: describeObservation(model.contextTokens),
      tier: model.billing,
      ...(model.releaseDate === undefined ? {} : { releaseDate: model.releaseDate }),
    }))
    .sort(compareModelsNewestFirst);
};

/** Every model key the catalog carries for the product's overlay sources, offered or withheld. */
const catalogModelIds = (catalog: ModelsDevCatalog, productId: RunnableProductId): Set<string> => {
  const ids = new Set<string>();
  for (const sourceId of PROVIDER_OVERLAY[productId]?.modelsDevIds ?? []) {
    for (const modelKey of Object.keys(catalog[sourceId]?.models ?? {})) ids.add(modelKey);
  }
  return ids;
};

/** The display name a same-vendor models.dev source carries for the identical key, if any. */
const borrowedCatalogName = (
  catalog: ModelsDevCatalog,
  productId: RunnableProductId,
  modelId: string,
): string | undefined => {
  for (const sourceId of PROVIDER_OVERLAY[productId]?.nameSourceIds ?? []) {
    const name = catalog[sourceId]?.models[modelId]?.name;
    if (name) return name;
  }
  return undefined;
};

const describeLiveOnly = (model: LiveModel): string => {
  const context = describeObservation(model.contextTokens);
  if (model.tier !== "unknown") return context;
  return context ? `${context} · pricing unknown` : LIVE_ONLY_MODEL_DESCRIPTION;
};

/**
 * Gemini's OpenAI-compat list names every generativelanguage route — embeddings,
 * tts, imagen — with no field that tells a review model apart, so live-only ids
 * are excluded there: the catalog stays authoritative for which gemini rows
 * exist, and the live list only prunes rows the provider no longer serves.
 */
const LIVE_ONLY_ROW_EXCLUDED_PRODUCTS = new Set<RunnableProductId>(["gemini"]);

/**
 * The provider's live list is the id set; models.dev supplies the row where it
 * knows the id. A model the catalog knows but withheld (non-text output, or a
 * declared structured-output refusal where `withholdsDeclaredStructuredOutputRefusal`
 * holds) stays withheld — the live list only adds ids the catalog has never
 * seen, and those still pass the product's model policy. Where that predicate
 * holds, the live list's own capability declaration withholds a route too,
 * whether or not the catalog knows it; pinned-downstream-route aggregators are
 * exempt, because their gateway drops an unsupported response_format instead
 * of rejecting the request, and local validation covers the rest.
 * A live-only row may borrow a display name from a same-vendor source, never
 * its price: the tier stays unknown and the row says so. The merged rows sort
 * newest first; live-only rows carry no release date, so they follow the dated
 * catalog rows in the provider's own list order.
 */
const mergeLiveModelList = (
  catalog: ModelsDevCatalog,
  productId: RunnableProductId,
  offered: readonly ModelInfo[],
  live: readonly LiveModel[],
): ModelInfo[] => {
  const offeredById = new Map(offered.map((model) => [model.id, model]));
  const known = catalogModelIds(catalog, productId);
  const withholds = withholdsDeclaredStructuredOutputRefusal(productId);
  const merged: ModelInfo[] = [];
  for (const model of live) {
    if (withholds && model.structuredOutput === false) continue;
    const offeredModel = offeredById.get(model.id);
    if (offeredModel) {
      merged.push(offeredModel);
      continue;
    }
    if (LIVE_ONLY_ROW_EXCLUDED_PRODUCTS.has(productId)) continue;
    if (known.has(model.id) || !isModelIdAllowedForProduct(productId, model.id)) continue;
    merged.push({
      id: model.id,
      name: model.name ?? borrowedCatalogName(catalog, productId, model.id) ?? model.id,
      description: describeLiveOnly(model),
      tier: model.tier,
    });
  }
  return merged.sort(compareModelsNewestFirst);
};

const providerModelsResponse = (
  models: ModelInfo[],
  fetchedAt: string,
  source: ProviderModelsResponse["source"],
): ProviderModelsResponse =>
  source === "cache" || source === "provider-cache"
    ? { models, fetchedAt, source, cached: true }
    : { models, fetchedAt, source, cached: false };

export const providerModelsFromTier = (
  tier: CatalogTier,
  productId: RunnableProductId,
  liveList: LiveModelList | null,
): ProviderModelsResponse => {
  const offered = modelInfoFromBoundedObservation(
    tier.catalog,
    productId,
    observationSourceForResult(tier.source),
    tier.fetchedAt,
  );
  if (!liveList) return providerModelsResponse(offered, tier.fetchedAt, tier.source);
  const merged = mergeLiveModelList(tier.catalog, productId, offered, liveList.models);
  if (merged.length === 0) {
    // A list naming only ids the product policy rejects (a provider that lists
    // aliases instead of exact ids) must not blank a picker the catalog can
    // still fill.
    log("info", "live_model_list_ignored", { productId });
    return providerModelsResponse(offered, tier.fetchedAt, tier.source);
  }
  return providerModelsResponse(
    merged,
    liveList.fetchedAt,
    liveList.cached ? "provider-cache" : "provider-live",
  );
};
