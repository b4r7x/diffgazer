/**
 * The exact reasons catalog-backed model discovery reports when it returns no
 * models. The server emits them and the client allowlists them, so both sides
 * read the same two strings from here rather than hand-copying the prose.
 */
export const CATALOG_SKIPPED_REASON =
  "Catalog observations are unavailable for this configuration product.";

/**
 * Deliberately says "is not confirmed" rather than "cannot": the product this
 * reason exists for (Mistral, whose allowlist pins a model upstream publishes no
 * `structured_output` for) is withheld by silence, not by a published refusal.
 * Reporting that silence as a confirmed refusal is the same guess the catalog's
 * third `unknown` state exists to keep out of the UI.
 */
export const CATALOG_EMPTY_MODELS_REASON =
  "No model this product allows is confirmed to return structured review output. Configure a different provider to run reviews.";
