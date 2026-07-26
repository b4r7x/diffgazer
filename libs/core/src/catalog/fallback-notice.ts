import { getDateLabel, getTimestamp } from "../format.js";
import type { ProviderModelsResponse } from "../schemas/config/models.js";

type CatalogSource = ProviderModelsResponse["source"];

/** The catalog reports an ISO stamp; the notice is user-facing copy, so it reads as a time. */
function formatFetchTime(fetchedAt: string | null): string | null {
  if (!fetchedAt) return null;
  return `${getDateLabel(fetchedAt)} at ${getTimestamp(fetchedAt)}`;
}

export function getCatalogFallbackNotice(
  source: CatalogSource | null,
  fetchedAt: string | null,
): string | null {
  if (source === "cache") {
    return `Using cached catalog data from ${formatFetchTime(fetchedAt) ?? "an unknown time"}.`;
  }
  if (source === "snapshot") {
    return "Using the bundled model catalog because live catalog data is unavailable.";
  }
  return null;
}
