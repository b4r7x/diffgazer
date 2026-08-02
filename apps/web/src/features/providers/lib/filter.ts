import type { ProviderListRow } from "@diffgazer/core/providers";

export const PROVIDER_FILTERS = ["all", "configured", "needs-key", "free", "paid"] as const;
export type ProviderFilter = (typeof PROVIDER_FILTERS)[number];

export const PROVIDER_FILTER_LABELS: { value: ProviderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "configured", label: "Configured" },
  { value: "needs-key", label: "Needs Setup" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

function isRemovedRow(row: ProviderListRow): boolean {
  return row.product.status === "removed";
}

function isReadyRow(row: ProviderListRow): boolean {
  return row.readiness.ready;
}

function needsSetupRow(row: ProviderListRow): boolean {
  return !isRemovedRow(row) && !row.readiness.ready;
}

function hasFreeTier(row: ProviderListRow): boolean {
  if (row.product.status === "removed") return false;
  return row.product.billing.modes.includes("free-tier");
}

function matchesSearch(row: ProviderListRow, query: string): boolean {
  if (isRemovedRow(row)) return false;

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
    filtered = filtered.filter(isReadyRow);
  } else if (filter === "needs-key") {
    filtered = filtered.filter(needsSetupRow);
  } else if (filter === "free") {
    filtered = filtered.filter(hasFreeTier);
  } else if (filter === "paid") {
    filtered = filtered.filter((row) => !isRemovedRow(row) && !hasFreeTier(row));
  }

  const trimmed = searchQuery.trim();
  if (trimmed) {
    const query = trimmed.toLowerCase();
    filtered = filtered.filter((row) => matchesSearch(row, query));
  }

  return filtered;
}
