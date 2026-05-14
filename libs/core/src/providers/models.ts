import type { AIProvider, ModelInfo, OpenRouterModel } from "@diffgazer/core/schemas/config";
import {
  AVAILABLE_PROVIDERS,
  GEMINI_MODEL_INFO,
  GLM_MODEL_INFO,
} from "@diffgazer/core/schemas/config";
import { mapOpenRouterModels } from "../api/openrouter-utils.js";

export const TIER_FILTERS = ["all", "free", "paid"] as const;
export type TierFilter = (typeof TIER_FILTERS)[number];

export function getStaticModelsForProvider(providerId: AIProvider): ModelInfo[] {
  switch (providerId) {
    case "gemini":
      return Object.values(GEMINI_MODEL_INFO);
    case "zai":
    case "zai-coding":
      return Object.values(GLM_MODEL_INFO);
    case "openrouter":
      return [];
    default:
      return [];
  }
}

export function buildModels(
  providerId: AIProvider,
  openRouterModels: OpenRouterModel[],
): ModelInfo[] {
  if (providerId === "openrouter") {
    return mapOpenRouterModels(openRouterModels);
  }

  const staticModels = getStaticModelsForProvider(providerId);
  if (staticModels.length > 0) {
    return staticModels;
  }

  const provider = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return [];

  return provider.models.map((id) => ({
    id,
    name: id,
    description: id,
    tier: "paid" as const,
  }));
}

export function filterModels(
  models: ModelInfo[],
  tierFilter: TierFilter,
  searchQuery: string,
): ModelInfo[] {
  let filtered = models;

  if (tierFilter === "free") {
    filtered = filtered.filter((m) => m.tier === "free");
  } else if (tierFilter === "paid") {
    filtered = filtered.filter((m) => m.tier === "paid");
  }

  const trimmed = searchQuery.trim();
  if (trimmed) {
    const query = trimmed.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query),
    );
  }

  return filtered;
}

export function cycleTierFilter(current: TierFilter): TierFilter {
  const index = TIER_FILTERS.indexOf(current);
  const next = TIER_FILTERS[(index + 1) % TIER_FILTERS.length];
  return next ?? "all";
}
