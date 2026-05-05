import type { OpenRouterModel, ModelInfo } from "@diffgazer/core/schemas/config";

/**
 * Checks if an OpenRouter model supports structured output
 * (response_format or structured_outputs parameter).
 */
export function isOpenRouterCompatible(model: Pick<OpenRouterModel, "supportedParameters">): boolean {
  const params = model.supportedParameters ?? [];
  return params.includes("response_format") || params.includes("structured_outputs");
}

/**
 * Maps raw OpenRouter models to the shared ModelInfo shape.
 */
export function mapOpenRouterModels(models: OpenRouterModel[]): ModelInfo[] {
  return models.map((model) => ({
    id: model.id,
    name: model.name || model.id,
    description: model.description ?? model.id,
    tier: model.isFree ? "free" : "paid",
  }));
}
