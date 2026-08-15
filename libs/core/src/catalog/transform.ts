import {
  isModelIdAllowedForProduct,
  PRODUCT_REGISTRY,
  SELECTABLE_PRODUCT_IDS,
} from "../providers/product-registry.js";
import type { RunnableProductId, TransportFamily } from "../schemas/config/transports.js";
import {
  getModelBilling,
  getModelReviewCapability,
  type ModelBilling,
  type ModelReviewCapability,
} from "./model-capability.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";
import {
  CatalogModelNameSchema,
  type CatalogObservationSource,
  type CatalogSelectableModelId,
  CatalogSelectableModelIdSchema,
  type ModelsDevCatalog,
  type ModelsDevModel,
} from "./schema.js";

/**
 * The catalog is already validated at its ingestion boundary — the live fetch
 * and the snapshot generator both parse before anything reaches here. This
 * module joins observations to products; it does not re-validate them.
 */
export interface CatalogObservationInput {
  readonly source: CatalogObservationSource;
  readonly checkedAt: string;
  readonly catalog: ModelsDevCatalog;
}

export interface CatalogModelObservation {
  readonly modelId: CatalogSelectableModelId;
  /** models.dev display name, falling back to the model id when upstream has none. */
  readonly modelName: string;
  readonly sourceProviderId: string;
  readonly reviewCapability: ModelReviewCapability;
  readonly billing: ModelBilling;
  readonly contextTokens?: number;
  readonly outputTokens?: number;
}

export interface ProductCatalogObservation {
  readonly productId: RunnableProductId;
  readonly transportFamily: TransportFamily;
  readonly source: CatalogObservationSource;
  readonly checkedAt: string;
  readonly models: readonly CatalogModelObservation[];
}

// models.dev publishes 0 for limits it cannot state (e.g. groq whisper audio
// models); only a positive integer is a usable token count downstream.
function usableTokenLimit(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : undefined;
}

function toModelObservation(
  sourceProviderId: string,
  modelId: CatalogSelectableModelId,
  model: ModelsDevModel,
): CatalogModelObservation | null {
  const modelName = CatalogModelNameSchema.safeParse(model.name ?? model.id);
  if (!modelName.success) return null;

  const contextTokens = usableTokenLimit(model.limit?.context);
  const outputTokens = usableTokenLimit(model.limit?.output);
  return {
    modelId,
    modelName: modelName.data,
    sourceProviderId,
    reviewCapability: getModelReviewCapability(model),
    billing: getModelBilling(model),
    ...(contextTokens === undefined ? {} : { contextTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  };
}

/**
 * Half of the picker contract: the catalog states this model can run the
 * structured review. Unknown capability is excluded on purpose — an unproven
 * model belongs in nobody's list of what works.
 */
export function isReviewCapableObservation(observation: CatalogModelObservation): boolean {
  return observation.reviewCapability === "supported";
}

/**
 * The whole picker contract: capable AND admitted by the product's model policy.
 * Every table that claims to describe the offered set must apply both halves.
 * Capability alone describes a list no user ever sees — OpenRouter's capable
 * `openrouter/free` router is a routing selector its policy refuses to pin.
 */
export function isOfferableObservation(
  productId: RunnableProductId,
  observation: CatalogModelObservation,
): boolean {
  return (
    isReviewCapableObservation(observation) &&
    isModelIdAllowedForProduct(productId, observation.modelId)
  );
}

function collectModelObservations(
  catalog: ModelsDevCatalog,
  sourceIds: readonly string[],
): CatalogModelObservation[] {
  const models: CatalogModelObservation[] = [];

  for (const sourceProviderId of sourceIds) {
    const provider = catalog[sourceProviderId];
    if (!provider || provider.id !== sourceProviderId) continue;

    for (const [modelKey, model] of Object.entries(provider.models)) {
      const modelId = CatalogSelectableModelIdSchema.safeParse(model.id);
      if (modelKey !== model.id || !modelId.success) continue;

      const observation = toModelObservation(sourceProviderId, modelId.data, model);
      if (observation) models.push(observation);
    }
  }

  return models.sort((left, right) => {
    if (left.modelId < right.modelId) return -1;
    if (left.modelId > right.modelId) return 1;
    return 0;
  });
}

export function transformCatalogObservation(
  observation: CatalogObservationInput,
): ProductCatalogObservation[] {
  return SELECTABLE_PRODUCT_IDS.flatMap((productId) => {
    const overlay = PROVIDER_OVERLAY[productId];
    if (!overlay) return [];

    return [
      {
        productId,
        transportFamily: PRODUCT_REGISTRY[productId].transportFamily,
        source: observation.source,
        checkedAt: observation.checkedAt,
        models: collectModelObservations(observation.catalog, overlay.modelsDevIds),
      },
    ];
  });
}
