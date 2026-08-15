import {
  CATALOG_SNAPSHOT,
  type CatalogModelObservation,
  PROVIDER_OVERLAY,
} from "@diffgazer/core/catalog";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import type { ExecutionLimits } from "@diffgazer/core/schemas/review";
import { effectiveExecutionLimits } from "../ai/budget/ledger.js";
import type {
  ConfigurationBudgetLimits,
  SupportedProviderConfigurationRecord,
} from "./provider-config.js";

export function executionLimitsFromBudget(budget: ConfigurationBudgetLimits): ExecutionLimits {
  return Object.freeze({
    maxInputTokens: budget.inputTokens,
    maxOutputTokens: budget.outputTokens,
    maxResponseBytes: budget.responseBytes,
    wallTimeMs: budget.wallTimeMs,
    maxRetries: budget.retries,
    maxConcurrency: budget.concurrency,
    maxCostUsd: budget.perReview,
  });
}

/**
 * Provider-advertised ceilings may only reduce configured local caps. Admission
 * projects the returned budget verbatim into execution limits.
 */
export function budgetWithinModelObservation(
  budget: ConfigurationBudgetLimits,
  observation: Pick<CatalogModelObservation, "contextTokens" | "outputTokens">,
): ConfigurationBudgetLimits {
  let limits = effectiveExecutionLimits(executionLimitsFromBudget(budget), {
    maxOutputTokens: observation.outputTokens,
  });
  if (observation.contextTokens !== undefined) {
    const maxInputTokens = observation.contextTokens - limits.maxOutputTokens;
    if (maxInputTokens > 0) {
      limits = effectiveExecutionLimits(limits, { maxInputTokens });
    }
  }
  return {
    ...budget,
    inputTokens: limits.maxInputTokens,
    outputTokens: limits.maxOutputTokens,
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
