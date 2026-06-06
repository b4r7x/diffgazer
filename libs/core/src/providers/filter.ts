import type { ProviderWithStatus } from "../schemas/config/index.js";
import { PROVIDER_CAPABILITIES } from "../schemas/config/index.js";

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
    // D2: the provider free/paid filter keys off the curated hasFreeTier fact
    // (surfaced as the binary tierBadge), not the derived per-model `tier` whose
    // "mixed" value would drop every free-tier provider that also has a paid model.
    filtered = filtered.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tierBadge === "FREE");
  } else if (filter === "paid") {
    filtered = filtered.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tierBadge === "PAID");
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
