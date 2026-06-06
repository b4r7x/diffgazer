import type { AIProvider } from "../schemas/config/index.js";
import { formatContextTokens } from "./format.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";
import type { ModelsDevCatalog, ModelsDevModel } from "./schema.js";
import { isModelFreeToUse, mergeModelsAcrossSources } from "./transform.js";

export type ProviderCapabilities = {
  toolCalling: string;
  jsonMode: string;
  streaming: string;
  contextWindow: string;
  tier: "free" | "paid" | "mixed";
  tierBadge: "FREE" | "PAID";
  capabilities: string[];
  costDescription: string;
};

function formatContext(maxContext: number): string {
  if (maxContext <= 0) return "Varies by model";
  return `Up to ${formatContextTokens(maxContext)} tokens`;
}

function resolveTier(models: ModelsDevModel[], provider: AIProvider): "free" | "paid" | "mixed" {
  const overlay = PROVIDER_OVERLAY[provider];
  // No models to classify: stay consistent with the overlay's free-tier badge
  // instead of defaulting to 'paid' (which would contradict a FREE badge).
  if (models.length === 0) return overlay.hasFreeTier ? "free" : "paid";

  let hasFree = false;
  let hasPaid = false;
  for (const model of models) {
    if (isModelFreeToUse(model, overlay)) hasFree = true;
    else hasPaid = true;
  }
  if (hasFree && hasPaid) return "mixed";
  if (hasFree) return "free";
  return "paid";
}

export function deriveCapabilities(catalog: ModelsDevCatalog, provider: AIProvider): ProviderCapabilities {
  const overlay = PROVIDER_OVERLAY[provider];
  const models = mergeModelsAcrossSources(catalog, overlay.modelsDevIds);

  const maxContext = models.reduce((max, m) => Math.max(max, m.limit?.context ?? 0), 0);
  const anyToolCall = models.some((m) => m.tool_call === true);
  const anyStructured = models.some((m) => m.structured_output === true);
  const anyReasoning = models.some((m) => m.reasoning === true);

  const capabilities: string[] = [];
  if (anyToolCall) capabilities.push("TOOLS");
  // JSON mode is always offered; structured_output only upgrades the jsonMode prose.
  capabilities.push("JSON");
  if (anyReasoning) capabilities.push("REASONING");

  const tier = resolveTier(models, provider);
  const tierBadge: "FREE" | "PAID" = overlay.hasFreeTier ? "FREE" : "PAID";

  const costDescription = overlay.freeTierNote
    ? `${overlay.freeTierNote} Live pricing per model.`
    : overlay.hasFreeTier
      ? "Free and paid tiers vary by model; live pricing drives the per-model badge."
      : "Paid usage; live pricing drives the per-model badge.";

  return {
    toolCalling: anyToolCall ? "Supported (tool / function calling)" : "Varies by model",
    jsonMode: anyStructured
      ? "Supported (structured output / JSON schema)"
      : "Supported where the model offers JSON output",
    streaming: "Supported (model-dependent)",
    contextWindow: formatContext(maxContext),
    tier,
    tierBadge,
    capabilities,
    costDescription,
  };
}
