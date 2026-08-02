import { z } from "zod";
import { ClientConfigurationSummarySchema, ConfigurationIdSchema } from "./provider-config.js";
import { ReadinessSchema } from "./readiness.js";
import { SettingsConfigSchema, TrustConfigSchema } from "./settings.js";

export const ConfigurationStatusSchema = z.strictObject({
  configuration: ClientConfigurationSummarySchema,
  readiness: ReadinessSchema,
});
export type ConfigurationStatus = z.infer<typeof ConfigurationStatusSchema>;

export const ConfigurationListResponseSchema = z.strictObject({
  schemaVersion: z.literal(2),
  configurations: z.array(ConfigurationStatusSchema),
  selectedConfigurationId: ConfigurationIdSchema.nullable(),
});
export type ConfigurationListResponse = z.infer<typeof ConfigurationListResponseSchema>;

export const ProjectInfoSchema = z.strictObject({
  path: z.string(),
  projectId: z.string().nullable(),
  trust: TrustConfigSchema.nullable(),
});
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;

export const ConfigurationInitResponseSchema = ConfigurationListResponseSchema.safeExtend({
  settings: SettingsConfigSchema,
  project: ProjectInfoSchema,
});
export type ConfigurationInitResponse = z.infer<typeof ConfigurationInitResponseSchema>;

/**
 * The single resolver for "which configuration is currently selected".  Both
 * response families (init and list) carry the same selection pair, so every
 * surface must read the selection through this function instead of re-deriving
 * the lookup and disagreeing about missing or dangling ids.
 */
export function resolveSelectedConfiguration(
  response:
    | Pick<ConfigurationListResponse, "configurations" | "selectedConfigurationId">
    | null
    | undefined,
): ConfigurationStatus | null {
  const selectedConfigurationId = response?.selectedConfigurationId;
  if (!selectedConfigurationId) return null;
  return (
    response.configurations.find(
      ({ configuration }) => configuration.configurationId === selectedConfigurationId,
    ) ?? null
  );
}

/**
 * Internal projection retained for the diagnostics adapter while callers move
 * to the V2 configuration/readiness response. It is derived from V2 data and
 * is not a server payload or a credential/provider authority.
 */
export interface SetupStatus {
  readonly hasSecretsStorage: boolean;
  readonly hasProvider: boolean;
  readonly hasModel: boolean;
  readonly hasTrust: boolean;
  readonly isConfigured: boolean;
  readonly isReady: boolean;
  readonly missing: readonly string[];
}
