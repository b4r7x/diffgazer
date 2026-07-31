import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "../providers/product-registry.js";
import type { RunnableProductId, TransportFamily } from "../schemas/config/transports.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";
import {
  CatalogModelNameSchema,
  CatalogObservationSchema,
  type CatalogObservationSource,
  type CatalogSelectableModelId,
  CatalogSelectableModelIdSchema,
  type ModelsDevCatalog,
  type ModelsDevModel,
  parseModelsDevCatalog,
} from "./schema.js";

export interface RawCatalogObservation {
  readonly source: CatalogObservationSource;
  readonly checkedAt: string;
  readonly catalog: unknown;
}

export interface CatalogModelObservation {
  readonly modelId: CatalogSelectableModelId;
  readonly modelName: string;
  readonly sourceProviderId: string;
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

function toModelObservation(
  sourceProviderId: string,
  modelId: CatalogSelectableModelId,
  model: ModelsDevModel,
): CatalogModelObservation | null {
  const modelName = CatalogModelNameSchema.safeParse(model.name ?? model.id);
  if (!modelName.success) return null;

  return {
    modelId,
    modelName: modelName.data,
    sourceProviderId,
    ...(model.limit?.context === undefined ? {} : { contextTokens: model.limit.context }),
    ...(model.limit?.output === undefined ? {} : { outputTokens: model.limit.output }),
  };
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
  rawObservation: RawCatalogObservation,
): ProductCatalogObservation[] {
  const observation = CatalogObservationSchema.parse({
    source: rawObservation.source,
    checkedAt: rawObservation.checkedAt,
    catalog: parseModelsDevCatalog(rawObservation.catalog),
  });

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
