import { z } from "zod";
import { refineConfigurationReadinessConsistency } from "./configuration-readiness-consistency.js";
import { ClientConfigurationSummarySchema, ConfigurationIdSchema } from "./provider-config.js";
import { type Readiness, ReadinessSchema } from "./readiness.js";
import { SettingsConfigSchema, TrustConfigSchema } from "./settings.js";
import { hasRepositoryReadAccess } from "./trust-capabilities.js";

export const ConfigurationStatusSchema = z
  .strictObject({
    configuration: ClientConfigurationSummarySchema,
    readiness: ReadinessSchema,
  })
  .superRefine(refineConfigurationReadinessConsistency);
export type ConfigurationStatus = z.infer<typeof ConfigurationStatusSchema>;

/**
 * A stored record this build cannot decode — the shape a configuration takes
 * once its product is retired from the runnable set, or once a newer build
 * writes something this one does not understand. The bytes are preserved
 * untouched, so the id is the only thing the product can honestly say about it,
 * and removal is the only thing it can honestly offer.
 */
export const UnrecognizedConfigurationSchema = z.strictObject({
  configurationId: ConfigurationIdSchema,
});
export type UnrecognizedConfiguration = z.infer<typeof UnrecognizedConfigurationSchema>;

export const ConfigurationListResponseSchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    configurations: z.array(ConfigurationStatusSchema),
    unrecognizedConfigurations: z.array(UnrecognizedConfigurationSchema),
    selectedConfigurationId: ConfigurationIdSchema.nullable(),
  })
  .refine(
    (response) =>
      response.selectedConfigurationId === null ||
      response.configurations.some(
        ({ configuration }) => configuration.configurationId === response.selectedConfigurationId,
      ),
    {
      message: "selectedConfigurationId must reference a listed configuration",
      path: ["selectedConfigurationId"],
    },
  );
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
 * Diagnostics-only projection of setup gaps from the V2 init payload. Product
 * flows should consume `resolveSelectedConfiguration` and `Readiness` directly.
 */
export interface DiagnosticsSetupGaps {
  readonly isReady: boolean;
  readonly isConfigured: boolean;
  readonly missing: readonly string[];
  readonly readiness: Readiness | null;
}

export function deriveDiagnosticsSetupGaps(init: ConfigurationInitResponse): DiagnosticsSetupGaps {
  const selected = resolveSelectedConfiguration(init);
  const hasProvider = selected !== null;
  const hasModel = selected?.configuration.selectedModelId != null;
  const hasTrust = hasRepositoryReadAccess(init.project.trust, init.project.path);
  const hasSecretsStorage = init.settings.secretsStorage !== null;
  const isConfigured = hasProvider;
  const missing: string[] = [];

  if (!hasProvider) missing.push("provider");
  if (!hasModel) missing.push("model");
  if (!hasTrust) missing.push("trust");
  if (!hasSecretsStorage) missing.push("secrets storage");

  const readiness = selected?.readiness ?? null;
  const isReady =
    readiness?.status === "ready" && hasProvider && hasModel && hasTrust && hasSecretsStorage;

  return {
    isReady,
    isConfigured,
    missing,
    readiness,
  };
}

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
