import {
  isModelIdAllowedForProduct,
  PRODUCT_REGISTRY,
  SELECTABLE_PRODUCT_IDS,
} from "../providers/product-registry.js";
import type { RunnableProductId, TransportFamily } from "../schemas/config/transports.js";
import { getModelBilling, type ModelBilling, producesTextOutput } from "./model-capability.js";
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
  /** models.dev `structured_output`; absent when upstream states nothing. */
  readonly structuredOutput?: boolean;
  /** models.dev `release_date` (YYYY-MM-DD); absent when upstream states none. */
  readonly releaseDate?: string;
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

/**
 * A model whose output modalities cannot carry a review object — audio/image/
 * video-only, or multi-modal without a structured-output claim — is not an
 * observation at all: the same cut the snapshot trim makes offline.
 */
function toModelObservation(
  sourceProviderId: string,
  modelId: CatalogSelectableModelId,
  model: ModelsDevModel,
): CatalogModelObservation | null {
  if (!producesTextOutput(model)) return null;
  const modelName = CatalogModelNameSchema.safeParse(model.name ?? model.id);
  if (!modelName.success) return null;

  const structuredOutput = model.structured_output ?? undefined;
  const contextTokens = usableTokenLimit(model.limit?.context);
  const outputTokens = usableTokenLimit(model.limit?.output);
  return {
    modelId,
    modelName: modelName.data,
    sourceProviderId,
    ...(structuredOutput === undefined ? {} : { structuredOutput }),
    ...(model.release_date === undefined ? {} : { releaseDate: model.release_date }),
    billing: getModelBilling(model),
    ...(contextTokens === undefined ? {} : { contextTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  };
}

/**
 * The picker contract: admitted by the product's model policy, and not
 * published as unable to run the product's structured-output mode. Only a
 * product for which `withholdsDeclaredStructuredOutputRefusal` holds hides a
 * model whose catalog row says `structured_output: false`; json-object
 * products validate locally, and a catalog that states nothing hides nothing.
 * Every table that claims to describe the offered set must apply this one
 * predicate — OpenRouter's `openrouter/free` router is a routing selector its
 * policy refuses to pin.
 */
export function isOfferableObservation(
  productId: RunnableProductId,
  observation: CatalogModelObservation,
): boolean {
  if (
    observation.structuredOutput === false &&
    withholdsDeclaredStructuredOutputRefusal(productId)
  ) {
    return false;
  }
  return isModelIdAllowedForProduct(productId, observation.modelId);
}

/**
 * A declared structured-output refusal withholds a model only where the wire
 * hard-requires provider-side enforcement. On a pinned-downstream-route
 * aggregator the gateway accepts every pinned route and silently drops an
 * unsupported response_format (probed live 2026-08-26: json_schema strict on
 * declared-false OpenRouter routes → HTTP 200); local schema validation and
 * the structured-output verify check remain the quality gate there.
 */
export function withholdsDeclaredStructuredOutputRefusal(productId: RunnableProductId): boolean {
  return (
    PRODUCT_REGISTRY[productId].admission.structuredOutput === "strict-json-schema" &&
    PRODUCT_REGISTRY[productId].modelPolicy.kind !== "pinned-downstream-route"
  );
}

function collectModelObservations(
  catalog: ModelsDevCatalog,
  sourceIds: readonly string[],
): CatalogModelObservation[] {
  const models: CatalogModelObservation[] = [];
  // First source wins when overlay sources publish the same model id, so the
  // overlay's source order decides which price an overlapping id carries.
  const observedIds = new Set<string>();

  for (const sourceProviderId of sourceIds) {
    const provider = catalog[sourceProviderId];
    if (!provider || provider.id !== sourceProviderId) continue;

    for (const [modelKey, model] of Object.entries(provider.models)) {
      const modelId = CatalogSelectableModelIdSchema.safeParse(model.id);
      if (modelKey !== model.id || !modelId.success) continue;
      if (observedIds.has(modelId.data)) continue;

      const observation = toModelObservation(sourceProviderId, modelId.data, model);
      if (observation) {
        observedIds.add(observation.modelId);
        models.push(observation);
      }
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
