import { CATALOG_SNAPSHOT } from "@diffgazer/core/catalog";

/**
 * Retain the offline models.dev snapshot in the packaged diffgazer bundle.
 * Called from createApp so tsup cannot tree-shake the snapshot.
 */
export function bundledCatalogSnapshotSize(): number {
  let count = 0;
  for (const provider of Object.values(CATALOG_SNAPSHOT)) {
    count += Object.keys(provider.models).length;
  }
  return count;
}
