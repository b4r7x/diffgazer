import { createDomainErrorCodes, createDomainErrorSchema } from "../errors.js";

/** A provider whose overlay is `enabled:false` was requested. */
export const PROVIDER_DISABLED = "PROVIDER_DISABLED";

/** Catalog/config domain-specific error codes (shared codes are prepended by the helpers). */
export const CATALOG_SPECIFIC_ERROR_CODES = [PROVIDER_DISABLED] as const;

const CATALOG_ERROR_CODES = createDomainErrorCodes(CATALOG_SPECIFIC_ERROR_CODES);
export const CatalogErrorSchema = createDomainErrorSchema(CATALOG_SPECIFIC_ERROR_CODES);

export type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[number];
