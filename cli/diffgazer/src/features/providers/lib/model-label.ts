import { getCatalogModelName } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";

/**
 * Display name first, exact id after, because the id is the string a review
 * pins. Models outside the bounded catalog have only the one identity to show.
 */
export function formatModelLabel(productId: RunnableProductId, modelId: string): string {
  const name = getCatalogModelName(productId, modelId);
  return name === modelId ? modelId : `${name} · ${modelId}`;
}
