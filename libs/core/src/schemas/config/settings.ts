import { z } from "zod";
import { getDateKey } from "../../format.js";
import { ReviewSeveritySchema } from "../review/issues.js";
import { LensIdSchema, ProfileIdSchema } from "../review/lens.js";

export const TrustCapabilitiesSchema = z.object({
  readFiles: z.boolean(),
  runCommands: z.boolean(),
});
export type TrustCapabilities = z.infer<typeof TrustCapabilitiesSchema>;

const TRUST_MODES = ["persistent"] as const;
const TrustModeSchema = z.enum(TRUST_MODES);

export const TrustConfigSchema = z.object({
  projectId: z.string(),
  repoRoot: z.string(),
  trustedAt: z.iso.datetime(),
  capabilities: TrustCapabilitiesSchema,
  trustMode: TrustModeSchema,
});
export type TrustConfig = z.infer<typeof TrustConfigSchema>;

// The server derives identity (projectId, repoRoot, trustedAt) from the request
// and forces runCommands off, so the client only sends the readable capability
// it controls and the trust mode.
export const SaveTrustRequestSchema = TrustConfigSchema.pick({
  trustMode: true,
}).extend({
  capabilities: TrustCapabilitiesSchema.pick({ readFiles: true }),
});
export type SaveTrustRequest = z.infer<typeof SaveTrustRequestSchema>;

export const TrustResponseSchema = z.object({ trust: TrustConfigSchema });

export const DeleteTrustResponseSchema = z.object({ removed: z.boolean() });

export const THEMES = ["auto", "dark", "light", "terminal"] as const;
export const ThemeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof ThemeSchema>;

export const SECRETS_STORAGE = ["file", "keyring"] as const;
export const SecretsStorageSchema = z.enum(SECRETS_STORAGE);
export type SecretsStorage = z.infer<typeof SecretsStorageSchema>;

export const AGENT_EXECUTION_MODES = ["parallel", "sequential"] as const;
export const AgentExecutionSchema = z.enum(AGENT_EXECUTION_MODES);
export type AgentExecution = z.infer<typeof AgentExecutionSchema>;

export const PROVIDER_CONSENT_VERSION = 1;

/**
 * The one consent every provider send rests on. Recorded once in settings; the
 * per-configuration notice acknowledgement is derived from it by the UIs and
 * only asked for again when a product's notice materially changes.
 */
export const PROVIDER_CONSENT_TEXT =
  "Diffgazer sends repository content (diffs, files you include) to the provider you configure, using your own credentials, and stores nothing remotely. Billing, rate limits, retention and training terms are that provider's — see each provider's notice.";

/** Where the consent points for the full account of what leaves the machine. */
export const PROVIDER_CONSENT_PRIVACY_URL = "https://docs.b4r7.dev/app/concepts/privacy";

export const ProviderConsentSchema = z.strictObject({
  version: z.literal(PROVIDER_CONSENT_VERSION),
  acceptedAt: z.iso.datetime(),
});
export type ProviderConsent = z.infer<typeof ProviderConsentSchema>;

export function acceptProviderConsent(acceptedAt = new Date().toISOString()): ProviderConsent {
  return { version: PROVIDER_CONSENT_VERSION, acceptedAt };
}

/** The notice's chrome, so the web dialog and the TUI overlay cannot read differently. */
export const PROVIDER_CONSENT_NOTICE = {
  title: "Provider data notice",
  askedOnce: "Asked once, before anything is sent to a provider",
  accept: "Accept",
  acceptAndContinue: "Accept and continue",
  notNow: "Not now",
  close: "Close",
} as const;

/** How an accepted consent reads back: in the notice, and on the settings hub row. */
export function describeAcceptedProviderConsent(consent: ProviderConsent): string {
  return `Accepted ${getDateKey(consent.acceptedAt)}`;
}

export const SettingsConfigSchema = z.object({
  theme: ThemeSchema,
  defaultLenses: z
    .array(LensIdSchema)
    .min(1)
    .overwrite((lenses) => [...new Set(lenses)]),
  defaultProfile: ProfileIdSchema.nullable(),
  severityThreshold: ReviewSeveritySchema,
  secretsStorage: SecretsStorageSchema.nullable(),
  agentExecution: AgentExecutionSchema,
  providerConsent: ProviderConsentSchema.nullable(),
});
export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;

export const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  secretsStorage: null,
  defaultLenses: ["correctness", "security", "performance", "simplicity", "tests"],
  defaultProfile: null,
  severityThreshold: "low",
  agentExecution: "sequential",
  providerConsent: null,
};

const SettingsFieldSchemas = SettingsConfigSchema.shape;

function isSettingsField(key: string): key is keyof SettingsConfig {
  return Object.hasOwn(SettingsFieldSchemas, key);
}

export interface SettingsFieldDiagnostic {
  readonly field: keyof SettingsConfig;
  readonly code: "invalid-value";
}

export interface ParsedSettingsRecord {
  readonly settings: SettingsConfig;
  readonly unknown: Record<string, unknown>;
  readonly diagnostics: readonly SettingsFieldDiagnostic[];
}

/**
 * Project a persisted settings object onto the typed contract. Unknown keys and
 * known fields whose values fail validation are preserved opaquely so unrelated
 * writes cannot destroy them.
 */
export function parseSettingsRecord(rawSettings: Record<string, unknown>): ParsedSettingsRecord {
  const values: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const unknown = Object.create(null) as Record<string, unknown>;
  const diagnostics: SettingsFieldDiagnostic[] = [];

  for (const [key, value] of Object.entries(rawSettings)) {
    if (!isSettingsField(key)) {
      unknown[key] = value;
      continue;
    }
    const parsed = SettingsFieldSchemas[key].safeParse(value);
    if (parsed.success) {
      values[key] = parsed.data;
      continue;
    }
    unknown[key] = value;
    diagnostics.push({ field: key, code: "invalid-value" });
  }

  return { settings: SettingsConfigSchema.parse(values), unknown, diagnostics };
}

/** Serialize typed settings while keeping salvaged known-field bytes in unknown. */
export function serializeSettingsRecord(parsed: ParsedSettingsRecord): Record<string, unknown> {
  const typed = SettingsConfigSchema.parse(parsed.settings);
  const result = { ...parsed.unknown };
  for (const [key, value] of Object.entries(typed)) {
    if (!Object.hasOwn(parsed.unknown, key)) {
      result[key] = value;
    }
  }
  return result;
}

/** Apply a typed patch without dropping salvaged or unknown persisted keys. */
export function applySettingsPatch(
  rawSettings: Record<string, unknown>,
  patch: Partial<SettingsConfig>,
): Record<string, unknown> {
  const merged = { ...serializeSettingsRecord(parseSettingsRecord(rawSettings)), ...patch };
  return serializeSettingsRecord(parseSettingsRecord(merged));
}
