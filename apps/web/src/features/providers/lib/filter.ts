import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  getBillingTier,
  offersFreeModels,
  UNRECOGNIZED_CONFIGURATION_COPY,
} from "@diffgazer/core/providers";
import type { UnrecognizedConfiguration } from "@diffgazer/core/schemas/config";
import { getProviderRowDisplayName } from "./display-name";

export const PROVIDER_FILTERS = ["all", "configured", "needs-key", "free", "paid"] as const;
export type ProviderFilter = (typeof PROVIDER_FILTERS)[number];

const FILTER_LABELS: Record<ProviderFilter, string> = {
  all: "All",
  configured: "Configured",
  "needs-key": "Needs Setup",
  free: "Free",
  paid: "Paid",
};

// The keyboard layer records a filter as its index in PROVIDER_FILTERS and the
// list resolves that index back through this array, so the two must share one
// ordering. Deriving it from the tuple is what keeps them aligned.
export const PROVIDER_FILTER_LABELS: { value: ProviderFilter; label: string }[] =
  PROVIDER_FILTERS.map((value) => ({ value, label: FILTER_LABELS[value] }));

// "Configured" means a stored configuration exists; readiness (e.g. pending
// conformance) is a separate axis and must not hide the row from this filter.
function hasConfiguration(row: ProviderListRow): boolean {
  return row.configuration !== null;
}

// A product selling both free and priced review-capable models belongs under
// both filters; hiding it from either would misdescribe half its catalog.
function hasFreeModels(row: ProviderListRow): boolean {
  return offersFreeModels(getBillingTier(row.product.productId));
}

function hasOnlyFreeModels(row: ProviderListRow): boolean {
  return getBillingTier(row.product.productId) === "free";
}

// A configured dual-pool row renders as its pool ("OpenCode Go"), so the
// displayed name has to be searchable alongside the product name a row that is
// not configured still shows.
function matchesSearch(row: ProviderListRow, query: string): boolean {
  const name = row.product.name.toLowerCase();
  const productId = row.product.productId.toLowerCase();
  const displayName = getProviderRowDisplayName(row).toLowerCase();
  return name.includes(query) || productId.includes(query) || displayName.includes(query);
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
    filtered = filtered.filter(hasFreeModels);
  } else if (filter === "paid") {
    filtered = filtered.filter((row) => !hasOnlyFreeModels(row));
  }

  const trimmed = searchQuery.trim();
  if (trimmed) {
    const query = trimmed.toLowerCase();
    filtered = filtered.filter((row) => matchesSearch(row, query));
  }

  return filtered;
}

/**
 * A record this build could not decode is still a stored configuration, so it
 * belongs under All and Configured. Every other filter asks about a product it
 * has none of, so it is not offered there.
 */
export function filterUnrecognizedConfigurations(
  configurations: readonly UnrecognizedConfiguration[],
  filter: ProviderFilter,
  searchQuery = "",
): UnrecognizedConfiguration[] {
  if (filter !== "all" && filter !== "configured") return [];

  const query = searchQuery.trim().toLowerCase();
  if (!query) return [...configurations];

  const label = UNRECOGNIZED_CONFIGURATION_COPY.label.toLowerCase();
  return configurations.filter(
    ({ configurationId }) => configurationId.toLowerCase().includes(query) || label.includes(query),
  );
}
