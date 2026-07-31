import { SELECTABLE_PRODUCT_IDS } from "../providers/product-registry.js";
import type { RunnableProductId } from "../schemas/config/transports.js";
import type { CatalogObservationSource, ModelsDevCatalog } from "./schema.js";

export type { CatalogObservationSource } from "./schema.js";

export type ProviderOverlay = {
  readonly modelsDevIds: readonly string[];
};

export const PROVIDER_OVERLAY: Partial<Record<RunnableProductId, ProviderOverlay>> = {
  gemini: { modelsDevIds: ["google"] },
  zai: { modelsDevIds: ["zai"] },
  openrouter: { modelsDevIds: ["openrouter"] },
  groq: { modelsDevIds: ["groq"] },
  cerebras: { modelsDevIds: ["cerebras"] },
  mistral: { modelsDevIds: ["mistral"] },
};

export interface CatalogAvailabilityObservation {
  readonly productId: RunnableProductId;
  readonly modelsDevIds: readonly string[];
  readonly source: CatalogObservationSource;
  readonly checkedAt: string;
}

export function projectCatalogAvailabilityObservations(
  source: CatalogObservationSource,
  checkedAt: string,
): CatalogAvailabilityObservation[] {
  return SELECTABLE_PRODUCT_IDS.flatMap((productId) => {
    const overlay = PROVIDER_OVERLAY[productId];
    return overlay ? [{ productId, modelsDevIds: overlay.modelsDevIds, source, checkedAt }] : [];
  });
}

export type CatalogSnapshotBundleEvidence = readonly [modelId: string, modelName: string];
const MIN_BUNDLE_EVIDENCE_MARKER_LENGTH = 8;

export function getCatalogSnapshotBundleEvidence(
  snapshot: ModelsDevCatalog,
  otherBundledInputs: readonly unknown[],
): CatalogSnapshotBundleEvidence {
  const otherSources = otherBundledInputs.map((value) => JSON.stringify(value) ?? "").join("\n");

  for (const provider of Object.values(snapshot)) {
    for (const model of Object.values(provider.models)) {
      if (
        !model.name ||
        model.id.length < MIN_BUNDLE_EVIDENCE_MARKER_LENGTH ||
        model.name.length < MIN_BUNDLE_EVIDENCE_MARKER_LENGTH
      ) {
        continue;
      }
      const evidence = [model.id, model.name] as const;
      if (evidence.every((marker) => !otherSources.includes(marker))) return evidence;
    }
  }

  throw new Error(
    "CATALOG_SNAPSHOT has no model id/name evidence unique to the other bundled inputs",
  );
}

export function assertCatalogSnapshotBundleEvidence(
  bundleSource: string,
  evidence: CatalogSnapshotBundleEvidence,
): void {
  const missing = evidence.filter((marker) => !bundleSource.includes(marker));
  if (missing.length > 0) {
    throw new Error(
      `CATALOG_SNAPSHOT evidence missing from bundle: ${missing.map((marker) => JSON.stringify(marker)).join(", ")}`,
    );
  }
}
