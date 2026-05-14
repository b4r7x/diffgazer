import { useState } from "react";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import {
  cycleTierFilter as cycleTierFilterCore,
  filterModels,
  type TierFilter,
} from "@diffgazer/core/providers";

export type { TierFilter };

export function useModelFilter(models: ModelInfo[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const filteredModels = filterModels(models, tierFilter, searchQuery);

  const cycleTierFilter = () => {
    setTierFilter(cycleTierFilterCore);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setTierFilter("all");
  };

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
