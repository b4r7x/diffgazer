import { type ClientProductMetadata, projectClientProduct } from "./client-metadata.js";
import { SELECTABLE_PRODUCT_IDS } from "./product-registry.js";

/** The safe client projection of every product a user may select during setup. */
export const SELECTABLE_PRODUCTS: readonly ClientProductMetadata[] =
  SELECTABLE_PRODUCT_IDS.map(projectClientProduct);
