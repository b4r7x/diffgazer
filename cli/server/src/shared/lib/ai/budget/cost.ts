import { CATALOG_SNAPSHOT, PROVIDER_OVERLAY } from "@diffgazer/core/catalog";
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
  const overlay = PROVIDER_OVERLAY[productId];
  if (!overlay) return null;

  for (const sourceId of overlay.modelsDevIds) {
    const provider = CATALOG_SNAPSHOT[sourceId];
    if (!provider) continue;
    const model = provider.models[modelId];
    if (!model || model.id !== modelId || !model.cost) continue;
    return {
      inputPerTokenUsd: perTokenUsd(model.cost.input),
      outputPerTokenUsd: perTokenUsd(model.cost.output),
    };
  }

  return null;
}

export function estimateUsageCostUsd(
  pricing: ModelPricing,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
): number {
  return (
    usage.inputTokens * pricing.inputPerTokenUsd + usage.outputTokens * pricing.outputPerTokenUsd
  );
}

/** What the admitted model can bill if it spends the whole admitted envelope. */
export function estimateWorstCaseCostUsd(
  productId: RunnableProductId,
  modelId: string,
  limits: ExecutionLimits,
): number | null {
  const pricing = resolveModelPricing(productId, modelId);
  if (!pricing) return null;
  return estimateUsageCostUsd(pricing, {
    inputTokens: limits.maxInputTokens,
    outputTokens: limits.maxOutputTokens,
  });
}
