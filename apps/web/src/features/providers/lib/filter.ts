import type { ProviderListRow } from "@diffgazer/core/providers";
import { getBillingTier } from "@diffgazer/core/providers";

export const PROVIDER_FILTERS = ["all", "configured", "needs-key", "free", "paid"] as const;
export type ProviderFilter = (typeof PROVIDER_FILTERS)[number];

export const PROVIDER_FILTER_LABELS: { value: ProviderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "configured", label: "Configured" },
  { value: "needs-key", label: "Needs Setup" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

// "Configured" means a stored configuration exists; readiness (e.g. pending
// conformance) is a separate axis and must not hide the row from this filter.
function hasConfiguration(row: ProviderListRow): boolean {
  return row.configuration !== null;
}

function hasFreeTier(row: ProviderListRow): boolean {
  return getBillingTier(row.product.productId) === "free";
}

function matchesSearch(row: ProviderListRow, query: string): boolean {
  const name = row.product.name.toLowerCase();
  const productId = row.product.productId.toLowerCase();
  return name.includes(query) || productId.includes(query);
}

export function filterProviders(
  providers: ProviderListRow[],
  filter: ProviderFilter,
  searchQuery = "",
): ProviderListRow[] {
  let filtered = providers;

  if (filter === "configured") {
    filtered = filtered.filter(hasConfiguration);
  } else if (filter === "needs-key") {
    filtered = filtered.filter((row) => !hasConfiguration(row));
  } else if (filter === "free") {
    filtered = filtered.filter(hasFreeTier);
  } else if (filter === "paid") {
    filtered = filtered.filter((row) => !hasFreeTier(row));
  }

  const trimmed = searchQuery.trim();
  if (trimmed) {
    const query = trimmed.toLowerCase();
    filtered = filtered.filter((row) => matchesSearch(row, query));
  }

  return filtered;
}
