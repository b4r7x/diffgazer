export { CATALOG_SNAPSHOT } from "./catalog-snapshot.js";
// Only the types cross the package boundary: the per-model predicates are
// catalog-internal, consumed by the transform and the snapshot generator.
export type {
  CatalogBillingRange,
  DerivedCatalogModel,
  ModelBilling,
  ModelReviewCapability,
} from "./model-capability.js";
export { CATALOG_MODEL_DERIVED } from "./model-derived.js";
export { PROVIDER_DERIVED } from "./provider-derived.js";
export {
  PROVIDER_OVERLAY,
  type ProviderOverlay,
} from "./provider-overlay.js";
export {
  CATALOG_OBSERVATION_SOURCES,
  type CatalogObservation,
  CatalogObservationSchema,
  type CatalogObservationSource,
  CatalogObservationSourceSchema,
  type CatalogSelectableModelId,
  CatalogSelectableModelIdSchema,
  type ModelsDevCatalog,
  ModelsDevCatalogSchema,
  type ModelsDevModel,
  ModelsDevModelSchema,
  ModelsDevProviderSchema,
  parseModelsDevCatalog,
} from "./schema.js";
// `isOfferableObservation` is the only picker predicate that crosses the
// boundary. Its capability-only half stays internal on purpose: it describes a
// list no user sees, because it counts models the product's own model policy
// refuses, so the package does not offer it.
export {
  type CatalogModelObservation,
  type CatalogObservationInput,
  isOfferableObservation,
  type ProductCatalogObservation,
  transformCatalogObservation,
} from "./transform.js";
