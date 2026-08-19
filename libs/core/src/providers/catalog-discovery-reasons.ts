/**
 * The exact reasons catalog-backed model discovery reports when it returns no
 * models. The server emits them and the client allowlists them, so both sides
 * read the same two strings from here rather than hand-copying the prose.
 */
export const CATALOG_SKIPPED_REASON =
  "Catalog observations are unavailable for this configuration product.";

export const CATALOG_EMPTY_MODELS_REASON =
  "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.";

/**
 * Secondary line for a model the provider's own list offers but models.dev has
 * not catalogued yet, when the list states no context size (with one, the row
 * reads "<size> context · pricing unknown" instead). The verdict leads because
 * narrow TUI columns truncate the tail.
 */
export const LIVE_ONLY_MODEL_DESCRIPTION = "Pricing unknown — not in models.dev yet";
