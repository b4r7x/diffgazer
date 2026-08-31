import { getProviderDisplay, type ProviderListRow } from "@diffgazer/core/providers";

/**
 * The name a provider row shows: a configured dual-pool product reads as the
 * pool its runs will bill, every other row as the product. The list, the pane
 * chip, the selection toast and the search index all answer the same question,
 * so they ask it in one place.
 */
export function getProviderRowDisplayName(row: ProviderListRow): string {
  return getProviderDisplay(row.product.productId, undefined, row.configuration?.endpoint);
}
