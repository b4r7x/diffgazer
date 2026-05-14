import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { PROVIDER_CAPABILITIES } from "@diffgazer/core/schemas/config";

export const PROVIDER_FILTERS = ["all", "configured", "needs-key", "free", "paid"] as const;
export type ProviderFilter = (typeof PROVIDER_FILTERS)[number];

export const PROVIDER_FILTER_LABELS: { value: ProviderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "configured", label: "Configured" },
  { value: "needs-key", label: "Needs Key" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

export function filterProviders(
  providers: ProviderWithStatus[],
  filter: ProviderFilter,
  searchQuery = "",
): ProviderWithStatus[] {
  let filtered = providers;

  if (filter === "configured") {
    filtered = filtered.filter((p) => p.hasApiKey);
  } else if (filter === "needs-key") {
    filtered = filtered.filter((p) => !p.hasApiKey);
  } else if (filter === "free") {
    filtered = filtered.filter((p) => {
      const tier = PROVIDER_CAPABILITIES[p.id]?.tier;
      return tier === "free" || tier === "mixed";
    });
  } else if (filter === "paid") {
    filtered = filtered.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === "paid");
  }

  const trimmed = searchQuery.trim();
  if (trimmed) {
    const query = trimmed.toLowerCase();
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query),
    );
  }

  return filtered;
}
