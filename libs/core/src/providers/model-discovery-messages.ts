import {
  CATALOG_EMPTY_MODELS_REASON,
  CATALOG_SKIPPED_REASON,
} from "./catalog-discovery-reasons.js";

export const MODEL_DISCOVERY_ERROR_FALLBACK =
  "Model discovery failed. Test the configuration again.";
export const MODEL_DISCOVERY_SKIPPED_FALLBACK =
  "Model discovery was skipped. Complete the required prerequisites, then test again.";

/** Every message a discovery producer can put in front of a user, verbatim. */
const SAFE_MODEL_DISCOVERY_MESSAGES = new Set([
  "Model discovery returned a different configuration tuple.",
  CATALOG_SKIPPED_REASON,
  CATALOG_EMPTY_MODELS_REASON,
]);

/**
 * Query failures and skipped reasons cross into Web/Ink state here. Only exact,
 * bounded, registry-owned copy may cross that boundary; provider/CLI output is
 * never sanitized into a client message or persisted.
 */
export function toClientSafeMessage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return SAFE_MODEL_DISCOVERY_MESSAGES.has(value) ? value : fallback;
}
