import type { ProviderCapabilities } from "../../catalog/capabilities.js";
import { PROVIDER_DERIVED } from "../../catalog/provider-derived.js";
import { PROVIDER_OVERLAY, type ProviderOverlay } from "../../catalog/provider-overlay.js";
import type { AIProvider, ProviderInfo } from "./providers.js";

export const OPENROUTER_PROVIDER_ID: AIProvider = "openrouter";

/**
 * Resolve a provider's human display name. PRIMARY source is the models.dev
 * provider `name` (precomputed into PROVIDER_DERIVED at snapshot generation for
 * the overlay's primary modelsDevId); `overlay.displayName` is a curated
 * OVERRIDE (today only gemini); humanize(id) is the last-resort fallback. The
 * precedence is applied once at generation time and frozen into PROVIDER_DERIVED.
 */
function resolveProviderDisplayName(provider: AIProvider): string {
  return PROVIDER_DERIVED[provider].displayName;
}

const ENABLED_PROVIDER_IDS = (Object.entries(PROVIDER_OVERLAY) as [AIProvider, ProviderOverlay][])
  .filter(([, overlay]) => overlay.enabled)
  .map(([id]) => id);

export const AVAILABLE_PROVIDERS: ProviderInfo[] = ENABLED_PROVIDER_IDS.map((id) => ({
  id,
  name: resolveProviderDisplayName(id),
  defaultModel: PROVIDER_OVERLAY[id].defaultModel,
}));

// Capability prose (tool calling, JSON mode, context window, tier) is stable per
// provider, so it is derived once at snapshot-generation time into
// PROVIDER_DERIVED rather than the live route — only the per-provider model LIST
// is served live via `GET /provider/:id/models`. Keyed over every overlay id (not
// just enabled) so the record stays exhaustive over AIProvider.
export const PROVIDER_CAPABILITIES = Object.fromEntries(
  (Object.keys(PROVIDER_OVERLAY) as AIProvider[]).map((id) => [
    id,
    PROVIDER_DERIVED[id].capabilities,
  ]),
) as Record<AIProvider, ProviderCapabilities>;

export const PROVIDER_ENV_VARS = Object.fromEntries(
  (Object.entries(PROVIDER_OVERLAY) as [AIProvider, ProviderOverlay][]).map(([id, overlay]) => [
    id,
    overlay.diffgazerEnvVar,
  ]),
) as Record<AIProvider, string>;

/** The set of env var names that are valid for `CredentialRef` with `kind: "env"`. */
export const ALLOWED_CREDENTIAL_ENV_VARS: ReadonlySet<string> = new Set(
  Object.values(PROVIDER_ENV_VARS),
);
