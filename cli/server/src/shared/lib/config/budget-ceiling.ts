import {
  CATALOG_SNAPSHOT,
  type CatalogModelObservation,
  PROVIDER_OVERLAY,
} from "@diffgazer/core/catalog";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import type { ExecutionLimits } from "@diffgazer/core/schemas/review";
import { PLANNING_OUTPUT_TOKENS } from "../ai/budget/cost.js";
import type {
  ConfigurationBudgetLimits,
  SupportedProviderConfigurationRecord,
} from "./provider-config.js";

export function executionLimitsFromBudget(budget: ConfigurationBudgetLimits): ExecutionLimits {
  return Object.freeze({
    maxInputTokens: budget.inputTokens,
    maxResponseBytes: budget.responseBytes,
    wallTimeMs: budget.wallTimeMs,
    maxRetries: budget.retries,
    maxConcurrency: budget.concurrency,
    maxCostUsd: budget.perReview,
  });
}

/**
 * The answer length a review reserves inside the model's context window: the
 * planned length, or the model's own output ceiling when that is smaller — a
 * model that cannot emit 32k tokens must not have 32k held back from its input.
 * A catalog that states no output ceiling reserves nothing.
 */
function answerReservationTokens(outputTokens: number | undefined): number {
  return Math.min(outputTokens ?? 0, PLANNING_OUTPUT_TOKENS);
}

/**
 * Provider-advertised ceilings may only reduce configured local caps. The input
 * cap is whatever the model's context window leaves once the planned answer
 * length is reserved — the same reservation the cost estimate prices, so the
 * two never disagree; a catalog without an output limit reserves nothing.
 */
export function budgetWithinModelObservation(
  budget: ConfigurationBudgetLimits,
  observation: Pick<CatalogModelObservation, "contextTokens" | "outputTokens">,
): ConfigurationBudgetLimits {
  if (observation.contextTokens === undefined) return budget;
  const availableInputTokens =
    observation.contextTokens - answerReservationTokens(observation.outputTokens);
  if (availableInputTokens <= 0) return budget;
  return {
    ...budget,
    inputTokens: Math.min(budget.inputTokens, availableInputTokens),
  };
}

function catalogObservationForModel(
  productId: RunnableProductId,
  modelId: string,
): Pick<CatalogModelObservation, "contextTokens" | "outputTokens"> | null {
  const overlay = PROVIDER_OVERLAY[productId];
  if (!overlay) return null;
  for (const sourceId of overlay.modelsDevIds) {
    const provider = CATALOG_SNAPSHOT[sourceId];
    if (!provider) continue;
    const model = provider.models[modelId];
    if (!model || model.id !== modelId) continue;
    const contextTokens = model.limit?.context;
    const outputTokens = model.limit?.output;
    return {
      ...(contextTokens !== undefined && contextTokens > 0 ? { contextTokens } : {}),
      ...(outputTokens !== undefined && outputTokens > 0 ? { outputTokens } : {}),
    };
  }
  return null;
}

/**
 * What one call to the selected model has room for: the context window the
 * bundled catalog states, and the answer length a review holds back inside it.
 * `null` when the catalog states no window — a size gate that cannot name the
 * ceiling must not invent one.
 */
export function resolveModelContextBudget(
  productId: RunnableProductId,
  modelId: string,
): { contextTokens: number; reservedAnswerTokens: number } | null {
  const observation = catalogObservationForModel(productId, modelId);
  if (observation?.contextTokens === undefined) return null;
  return {
    contextTokens: observation.contextTokens,
    reservedAnswerTokens: answerReservationTokens(observation.outputTokens),
  };
}

export function budgetForSelectedModel(
  budget: ConfigurationBudgetLimits,
  productId: RunnableProductId,
  modelId: string | null,
): ConfigurationBudgetLimits {
  if (!modelId) return budget;
  const observation = catalogObservationForModel(productId, modelId);
  return observation ? budgetWithinModelObservation(budget, observation) : budget;
}

export function effectiveBudgetForRecord(
  record: SupportedProviderConfigurationRecord,
): ConfigurationBudgetLimits {
  return budgetForSelectedModel(record.budget, record.productId, record.selectedModelId);
}
