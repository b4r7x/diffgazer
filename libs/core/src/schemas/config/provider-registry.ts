import {
  CATALOG_SNAPSHOT,
  deriveCapabilities,
  PROVIDER_OVERLAY,
  type ProviderCapabilities,
  type ProviderOverlay,
} from "../../catalog/index.js";
import type { AIProvider, ProviderInfo } from "./providers.js";

export const OPENROUTER_PROVIDER_ID: AIProvider = "openrouter";

/**
 * Title-case a provider id ("zai-coding" -> "Zai Coding"). Safety-only
 * last-resort fallback: every enabled provider resolves a name from its overlay
 * or the snapshot, so this is only reached if both are ever absent.
 */
function humanize(id: string): string {
  return id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Resolve a provider's human display name. PRIMARY source is the models.dev
 * provider `name` (from CATALOG_SNAPSHOT for the overlay's primary modelsDevId);
 * `overlay.displayName` is a curated OVERRIDE (today only gemini); humanize(id)
 * is the last-resort fallback.
 */
export function resolveProviderDisplayName(provider: AIProvider): string {
  const overlay = PROVIDER_OVERLAY[provider];
  const primaryModelsDevId = overlay.modelsDevIds[0];
  const modelsDevName = primaryModelsDevId ? CATALOG_SNAPSHOT[primaryModelsDevId]?.name : undefined;
  return overlay.displayName ?? modelsDevName ?? humanize(provider);
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
// provider, so it is derived once from the bundled CATALOG_SNAPSHOT rather than
// the live route — only the per-provider model LIST is served live via
// `GET /provider/:id/models`. Keyed over every overlay id (not just enabled) so
// the record stays exhaustive over AIProvider as a provider is enabled/disabled.
export const PROVIDER_CAPABILITIES = Object.fromEntries(
  (Object.keys(PROVIDER_OVERLAY) as AIProvider[]).map((id) => [
    id,
    deriveCapabilities(CATALOG_SNAPSHOT, id),
  ]),
) as Record<AIProvider, ProviderCapabilities>;

export const PROVIDER_ENV_VARS = Object.fromEntries(
  (Object.entries(PROVIDER_OVERLAY) as [AIProvider, ProviderOverlay][]).map(
    ([id, overlay]) => [id, overlay.diffgazerEnvVar],
  ),
) as Record<AIProvider, string>;

/** The set of env var names that are valid for `CredentialRef` with `kind: "env"`. */
export const ALLOWED_CREDENTIAL_ENV_VARS: ReadonlySet<string> = new Set(
  Object.values(PROVIDER_ENV_VARS),
);
