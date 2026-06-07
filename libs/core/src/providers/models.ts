import type { ModelInfo } from "../schemas/config/index.js";

export const TIER_FILTERS = ["all", "free", "paid"] as const;
export type TierFilter = (typeof TIER_FILTERS)[number];

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
      (m) => m.name.toLowerCase().includes(query) || m.description.toLowerCase().includes(query),
    );
  }

  return filtered;
}

export function cycleTierFilter(current: TierFilter): TierFilter {
  const index = TIER_FILTERS.indexOf(current);
  const next = TIER_FILTERS[(index + 1) % TIER_FILTERS.length];
  return next ?? "all";
}
