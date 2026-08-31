import { getProviderShortDisplay, type ProviderListRow } from "@diffgazer/core/providers";

/**
 * The name a provider row shows: the short human name, with the bound pool
 * appended for a configured dual-pool product. The list, the pane chip, the
 * selection toast and the search index all answer the same question, so they
 * ask it in one place.
 */
export function getProviderRowDisplayName(row: ProviderListRow): string {
  return getProviderShortDisplay(row.product.productId, row.configuration?.endpoint);
}
