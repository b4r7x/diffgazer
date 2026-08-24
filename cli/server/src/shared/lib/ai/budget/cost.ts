import { CATALOG_SNAPSHOT, type ModelsDevModel, PROVIDER_OVERLAY } from "@diffgazer/core/catalog";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import type { ExecutionLimits } from "@diffgazer/core/schemas/review";

/** models.dev publishes token prices in USD per million tokens. */
const CATALOG_PRICE_TOKENS = 1_000_000;

export type ModelPricing = Readonly<{
  inputPerTokenUsd: number;
  outputPerTokenUsd: number;
}>;

function perTokenUsd(perMillionTokensUsd: number | undefined): number {
  return perMillionTokensUsd !== undefined &&
    Number.isFinite(perMillionTokensUsd) &&
    perMillionTokensUsd >= 0
    ? perMillionTokensUsd / CATALOG_PRICE_TOKENS
    : 0;
}

function catalogModel(productId: RunnableProductId, modelId: string): ModelsDevModel | null {
  const overlay = PROVIDER_OVERLAY[productId];
  if (!overlay) return null;

  for (const sourceId of overlay.modelsDevIds) {
    const provider = CATALOG_SNAPSHOT[sourceId];
    if (!provider) continue;
    const model = provider.models[modelId];
    if (!model || model.id !== modelId) continue;
    return model;
  }

  return null;
}

/**
 * The price snapshot pinned to an admitted model. It comes from the bundled
 * catalog, never from a live provider response, so admission and settlement
 * charge the same numbers. A model the snapshot does not price returns `null`:
 * callers must not invent a price for it.
 */
export function resolveModelPricing(
  productId: RunnableProductId,
  modelId: string,
): ModelPricing | null {
  const model = catalogModel(productId, modelId);
  if (!model?.cost) return null;
  return {
    inputPerTokenUsd: perTokenUsd(model.cost.input),
    outputPerTokenUsd: perTokenUsd(model.cost.output),
  };
}

/**
 * The model's own output ceiling as the bundled catalog observes it. models.dev
 * publishes 0 for a limit it cannot state, which reads the same as absent.
 */
export function resolveModelOutputLimit(
  productId: RunnableProductId,
  modelId: string,
): number | null {
  const outputTokens = catalogModel(productId, modelId)?.limit?.output;
  return outputTokens !== undefined && outputTokens > 0 ? outputTokens : null;
}

export function estimateUsageCostUsd(
  pricing: ModelPricing,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
): number {
  return (
    usage.inputTokens * pricing.inputPerTokenUsd + usage.outputTokens * pricing.outputPerTokenUsd
  );
}

/**
 * The answer length reservations plan for. Catalog output ceilings run far past
 * anything a review answer reaches, and reserving them whole prices a request
 * out of a sane spend cap and eats the input envelope the review needs. It
 * bounds reservations only: no wire request carries it as an output cap.
 */
export const PLANNING_OUTPUT_TOKENS = 32_768;

/**
 * What the admitted model can bill if it spends the whole admitted input
 * envelope and answers up to the planned output length. A model the catalog
 * states no output limit for reserves input only.
 */
export function estimateWorstCaseCostUsd(
  productId: RunnableProductId,
  modelId: string,
  limits: Pick<ExecutionLimits, "maxInputTokens">,
): number | null {
  const pricing = resolveModelPricing(productId, modelId);
  if (!pricing) return null;
  const outputLimit = resolveModelOutputLimit(productId, modelId);
  return estimateUsageCostUsd(pricing, {
    inputTokens: limits.maxInputTokens,
    outputTokens: outputLimit === null ? 0 : Math.min(outputLimit, PLANNING_OUTPUT_TOKENS),
  });
}
