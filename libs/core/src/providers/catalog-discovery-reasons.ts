/**
 * The exact reason catalog-backed model discovery reports when it returns no
 * models. The server emits it and the client allowlists it, so both sides read
 * the same string from here rather than hand-copying the prose.
 */
export const CATALOG_EMPTY_MODELS_REASON =
  "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.";

/**
 * Secondary line for a model the provider's own list offers but no catalog
 * source prices — a brand-new or stealth route — when the list states no
 * context size (with one, the row reads "<size> context · pricing unknown"
 * instead). Plain wording: which upstream lacks the price is plumbing, not
 * something the picker should blame.
 */
export const LIVE_ONLY_MODEL_DESCRIPTION = "Pricing unknown";
