import type { ModelInfo, OpenRouterModel } from "@diffgazer/schemas/config";
import { AVAILABLE_PROVIDERS, GEMINI_MODEL_INFO, GLM_MODEL_INFO } from "@diffgazer/schemas/config";
import { mapOpenRouterModels } from "@diffgazer/api";

export interface DisplayModel {
  id: string;
  name: string;
  description?: string;
  tier: "free" | "paid";
}

export type TierFilter = "all" | "free" | "paid";
export const TIER_FILTERS: TierFilter[] = ["all", "free", "paid"];

export function getModelInfo(providerId: string): Record<string, ModelInfo> | undefined {
  switch (providerId) {
    case "gemini":
      return GEMINI_MODEL_INFO;
    case "zai":
    case "zai-coding":
      return GLM_MODEL_INFO;
    default:
      return undefined;
  }
}

export function buildModels(providerId: string, openRouterModels: OpenRouterModel[]): DisplayModel[] {
  if (providerId === "openrouter") {
    return mapOpenRouterModels(openRouterModels);
  }

  const provider = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return [];

  const infoMap = getModelInfo(providerId);
  if (!infoMap) {
    return provider.models.map((id) => ({ id, name: id, tier: "paid" as const }));
  }

  return provider.models.map((id) => {
    const info = infoMap[id];
    if (info) {
      return { id: info.id, name: info.name, description: info.description, tier: info.tier };
    }
    return { id, name: id, tier: "paid" as const };
  });
}

export function filterModels(models: DisplayModel[], tierFilter: TierFilter, searchQuery: string): DisplayModel[] {
  let filtered = models;

  if (tierFilter === "free") {
    filtered = filtered.filter((m) => m.tier === "free");
  } else if (tierFilter === "paid") {
    filtered = filtered.filter((m) => m.tier === "paid");
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        (m.description?.toLowerCase().includes(query) ?? false),
    );
  }

  return filtered;
}
