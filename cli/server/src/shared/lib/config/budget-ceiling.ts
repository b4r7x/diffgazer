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
    observation.contextTokens - Math.min(observation.outputTokens ?? 0, PLANNING_OUTPUT_TOKENS);
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
