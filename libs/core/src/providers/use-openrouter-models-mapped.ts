import { CatalogSelectableModelIdSchema } from "../catalog/schema.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import { isPinnedDownstreamRouteModelId } from "./product-registry.js";
import { type ModelSourceState, useModelSource } from "./use-model-source.js";

export type OpenRouterConfigurationSummary = ClientConfigurationSummary & {
  transportFamily: "hosted-api";
  productId: "openrouter";
};

export type OpenRouterModelsState = ModelSourceState & {
  total: number;
  pinned: number;
};

function isPinnedDownstreamRoute(modelId: string): boolean {
  if (!CatalogSelectableModelIdSchema.safeParse(modelId).success) return false;
  return isPinnedDownstreamRouteModelId(modelId);
}

export function getCompatibilityLabel({
  total,
  pinned,
}: Pick<OpenRouterModelsState, "total" | "pinned">): string {
  if (total === 0) return "No exact pinned downstream routes available.";
  if (pinned < total) return `Showing ${pinned}/${total} exact pinned downstream routes.`;
  return `Showing ${pinned} exact pinned downstream ${pinned === 1 ? "route" : "routes"}.`;
}

export function useOpenRouterModelsMapped(
  open: boolean,
  configuration: OpenRouterConfigurationSummary,
): OpenRouterModelsState {
  const source = useModelSource(open, configuration);
  if (source.status !== "passed") return { ...source, total: 0, pinned: 0 };

  const models = source.models.filter((model) => isPinnedDownstreamRoute(model.id));
  if (models.length === 0) {
    return {
      ...source,
      status: "error",
      models: [],
      reason: null,
      error: "The tested OpenRouter model is not an exact pinned downstream route.",
      total: source.models.length,
      pinned: 0,
    };
  }
  return {
    ...source,
    models,
    total: source.models.length,
    pinned: models.length,
  };
}
