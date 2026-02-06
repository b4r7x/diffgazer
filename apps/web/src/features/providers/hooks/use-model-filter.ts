import { useState, useMemo, useCallback } from "react";
import type { ModelInfo } from "@stargazer/schemas/config";
import { TIER_FILTERS, type TierFilter } from "@/features/providers/constants";

export type { TierFilter };

const TIER_CYCLE: TierFilter[] = [...TIER_FILTERS];

export function useModelFilter(models: ModelInfo[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const filteredModels = useMemo(
    () => filterModels(models, tierFilter, searchQuery),
    [models, tierFilter, searchQuery]
  );

  const cycleTierFilter = () => {
    setTierFilter((prev) => {
      const currentIndex = TIER_CYCLE.indexOf(prev);
      return TIER_CYCLE[(currentIndex + 1) % TIER_CYCLE.length];
    });
  };

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setTierFilter("all");
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    tierFilter,
    setTierFilter,
    filteredModels,
    cycleTierFilter,
    resetFilters,
  };
}

function filterModels(
  models: ModelInfo[],
  tierFilter: TierFilter,
  searchQuery: string
): ModelInfo[] {
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
        m.description.toLowerCase().includes(query)
    );
  }

  return filtered;
}
