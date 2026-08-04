/**
 * The exact reasons catalog-backed model discovery reports when it returns no
 * models. The server emits them and the client allowlists them, so both sides
 * read the same two strings from here rather than hand-copying the prose.
 */
export const CATALOG_SKIPPED_REASON =
  "Catalog observations are unavailable for this configuration product.";

export const CATALOG_EMPTY_MODELS_REASON =
  "No catalog models are available for this configuration product.";
