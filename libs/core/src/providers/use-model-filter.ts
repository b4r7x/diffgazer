import { useState } from "react";
import type { ModelInfo } from "../schemas/config/index.js";
import { cycleTierFilter as cycleTierFilterValue, filterModels, type TierFilter } from "./models.js";

export function useModelFilter(models: ModelInfo[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const filteredModels = filterModels(models, tierFilter, searchQuery);

  const cycleTierFilter = () => {
    setTierFilter(cycleTierFilterValue);
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
