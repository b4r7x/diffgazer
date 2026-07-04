import { z } from "zod";
import { ReviewSeveritySchema } from "../review/issues.js";
import { LensIdSchema, ProfileIdSchema } from "../review/lens.js";

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

export const THEMES = ["auto", "dark", "light", "terminal"] as const;
export const ThemeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof ThemeSchema>;

export const SECRETS_STORAGE = ["file", "keyring"] as const;
export const SecretsStorageSchema = z.enum(SECRETS_STORAGE);
export type SecretsStorage = z.infer<typeof SecretsStorageSchema>;

export const AGENT_EXECUTION_MODES = ["parallel", "sequential"] as const;
export const AgentExecutionSchema = z.enum(AGENT_EXECUTION_MODES);
export type AgentExecution = z.infer<typeof AgentExecutionSchema>;

export const SettingsConfigSchema = z.object({
  theme: ThemeSchema,
  defaultLenses: z.array(LensIdSchema),
  defaultProfile: ProfileIdSchema.nullable(),
  severityThreshold: ReviewSeveritySchema,
  secretsStorage: SecretsStorageSchema.nullable(),
  agentExecution: AgentExecutionSchema,
});
export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;
