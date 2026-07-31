import type { RemovedProductId, RunnableProductId } from "../schemas/config/transports.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";
import {
  type CatalogObservationSource,
  type CatalogSelectableModelId,
  CatalogSelectableModelIdSchema,
  type ModelsDevCatalog,
  type ModelsDevModel,
} from "./schema.js";

export type CapabilityObservationWindow = {
  readonly source: CatalogObservationSource;
  readonly checkedAt: string;
  readonly freshAfter: string;
};

export type ModelCapabilityObservation = {
  readonly productId: RunnableProductId;
  readonly modelId: CatalogSelectableModelId;
  readonly source: CatalogObservationSource;
  readonly checkedAt: string;
  readonly evidence: {
    readonly exactModelId: CatalogSelectableModelId;
    readonly structuredOutput: "catalog-observed";
  };
  readonly observedCapabilities: readonly ("structured-output" | "tool-calling" | "reasoning")[];
  readonly limits: {
    readonly contextTokens?: number;
    readonly outputTokens?: number;
  };
};

export type ProviderCapabilities = readonly ModelCapabilityObservation[];

function parseObservationTime(value: string): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) return null;
  return timestamp;
}

function hasFreshObservation(window: CapabilityObservationWindow): boolean {
  const checkedAt = parseObservationTime(window.checkedAt);
  const freshAfter = parseObservationTime(window.freshAfter);
  return checkedAt !== null && freshAfter !== null && checkedAt >= freshAfter;
}

function parseExactModelEvidence(
  modelKey: string,
  model: ModelsDevModel,
): CatalogSelectableModelId | null {
  if (model.id !== modelKey) return null;
  const parsed = CatalogSelectableModelIdSchema.safeParse(model.id);
  return parsed.success ? parsed.data : null;
}

function toObservation(
  productId: RunnableProductId,
  modelId: CatalogSelectableModelId,
  model: ModelsDevModel,
  window: CapabilityObservationWindow,
): ModelCapabilityObservation {
  const observedCapabilities: ModelCapabilityObservation["observedCapabilities"][number][] = [
    "structured-output",
  ];
  if (model.tool_call === true) observedCapabilities.push("tool-calling");
  if (model.reasoning === true) observedCapabilities.push("reasoning");

  return {
    productId,
    modelId,
    source: window.source,
    checkedAt: window.checkedAt,
    evidence: {
      exactModelId: modelId,
      structuredOutput: "catalog-observed",
    },
    observedCapabilities,
    limits: {
      ...(model.limit?.context === undefined ? {} : { contextTokens: model.limit.context }),
      ...(model.limit?.output === undefined ? {} : { outputTokens: model.limit.output }),
    },
  };
}

export function deriveCapabilities(
  catalog: ModelsDevCatalog,
  productId: RunnableProductId | RemovedProductId,
  window: CapabilityObservationWindow,
): ModelCapabilityObservation[] {
  if (!hasFreshObservation(window)) return [];
  if (productId === "zai-coding") return [];

  const overlay = PROVIDER_OVERLAY[productId];
  if (!overlay) return [];

  const observations: ModelCapabilityObservation[] = [];
  const observedModelIds = new Set<CatalogSelectableModelId>();

  for (const sourceId of overlay.modelsDevIds) {
    const source = catalog[sourceId];
    if (!source) continue;

    for (const [modelKey, model] of Object.entries(source.models)) {
      if (model.structured_output !== true) continue;
      const exactModelId = parseExactModelEvidence(modelKey, model);
      if (exactModelId === null || observedModelIds.has(exactModelId)) {
        continue;
      }

      observedModelIds.add(exactModelId);
      observations.push(toObservation(productId, exactModelId, model, window));
    }
  }

  return observations;
}
