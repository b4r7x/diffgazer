import {
  type ClientProductMetadata,
  projectClientProduct,
} from "../../providers/client-metadata.js";
import { SELECTABLE_PRODUCT_IDS } from "../../providers/product-registry.js";

export const SELECTABLE_PRODUCTS: readonly ClientProductMetadata[] =
  SELECTABLE_PRODUCT_IDS.map(projectClientProduct);
