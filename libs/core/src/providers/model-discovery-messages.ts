import type { ModelInfo } from "../schemas/config/models.js";
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

/**
 * A saved configuration can point at a model the current catalog list no longer
 * shows — retired upstream, or renamed. That configuration keeps working; this
 * is the note that says so instead of letting the row silently vanish. Returns
 * null while there is nothing to compare against — an empty or failed discovery
 * is not evidence about the selected model.
 */
export function getRetainedModelNotice(
  selectedModelId: string | null | undefined,
  models: readonly ModelInfo[],
): string | null {
  if (!selectedModelId || models.length === 0) return null;
  if (models.some((model) => model.id === selectedModelId)) return null;
  return `${selectedModelId} stays configured, but the current catalog no longer lists it. Choose a listed model to be sure it is still served.`;
}
