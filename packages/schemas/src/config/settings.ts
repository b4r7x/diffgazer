import { z } from "zod";
import { LensIdSchema, ProfileIdSchema } from "../review/lens.js";
import { ReviewSeveritySchema } from "../review/issues.js";

export const TrustCapabilitiesSchema = z.object({
  readFiles: z.boolean(),
  runCommands: z.boolean(),
});
export type TrustCapabilities = z.infer<typeof TrustCapabilitiesSchema>;

const TRUST_MODES = ["persistent", "session"] as const;
const TrustModeSchema = z.enum(TRUST_MODES);

export const TrustConfigSchema = z.object({
  projectId: z.string(),
  repoRoot: z.string(),
  trustedAt: z.string().datetime(),
  capabilities: TrustCapabilitiesSchema,
  trustMode: TrustModeSchema,
});
export type TrustConfig = z.infer<typeof TrustConfigSchema>;

export const THEMES = ["auto", "dark", "light", "terminal"] as const;
export const ThemeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof ThemeSchema>;

export const SECRETS_STORAGE = ["file", "keyring"] as const;
export const SecretsStorageSchema = z.enum(SECRETS_STORAGE);
export type SecretsStorage = z.infer<typeof SecretsStorageSchema>;

export const SettingsConfigSchema = z.object({
  theme: ThemeSchema,
  defaultLenses: z.array(LensIdSchema),
  defaultProfile: ProfileIdSchema.nullable(),
  severityThreshold: ReviewSeveritySchema,
  secretsStorage: SecretsStorageSchema.nullable(),
});
export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;
