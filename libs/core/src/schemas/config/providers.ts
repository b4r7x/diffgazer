import { z } from "zod";
import { timestampFields } from "../fields.js";
import { SettingsConfigSchema, TrustConfigSchema } from "./settings.js";

export const AI_PROVIDERS = [
  "gemini",
  "zai",
  "zai-coding",
  "openrouter",
  "groq",
  "cerebras",
] as const;
export const AIProviderSchema = z.enum(AI_PROVIDERS);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const ProviderInfoSchema = z.object({
  id: AIProviderSchema,
  name: z.string(),
  defaultModel: z.string(),
});
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

const DISPLAY_STATUSES = ["active", "configured", "needs-key"] as const;
const DisplayStatusSchema = z.enum(DISPLAY_STATUSES);
export type DisplayStatus = z.infer<typeof DisplayStatusSchema>;

export const ProviderWithStatusSchema = ProviderInfoSchema.extend({
  hasApiKey: z.boolean(),
  isActive: z.boolean(),
  model: z.string().optional(),
  displayStatus: DisplayStatusSchema,
});
export type ProviderWithStatus = z.infer<typeof ProviderWithStatusSchema>;

// Models come live from the catalog, so this schema-level check only enforces a
// non-empty model id. Catalog-membership enforcement lives in the server's
// activateProvider, which rejects a model absent from the provider's resolved
// catalog (OpenRouter excepted — its models come from its own live route).
export const UserConfigSchema = z
  .object({
    provider: AIProviderSchema,
    model: z.string().optional(),
    ...timestampFields,
  })
  .refine((data) => data.model === undefined || data.model.trim().length > 0, {
    error: "Model must not be empty",
    path: ["model"],
  });
export type UserConfig = z.infer<typeof UserConfigSchema>;

export const CredentialRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("literal"),
    value: z.string().trim().min(1, "API key must not be empty"),
  }),
  z.object({ kind: z.literal("env"), varName: z.string().min(1) }),
]);
export type CredentialRef = z.infer<typeof CredentialRefSchema>;

export const SaveConfigRequestSchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.union([z.string().trim().min(1, "API key must not be empty"), CredentialRefSchema]),
  model: z.string().trim().min(1, "Model must not be empty").optional(),
});
export type SaveConfigRequest = z.infer<typeof SaveConfigRequestSchema>;

export const ConfigCheckResponseSchema = z.discriminatedUnion("configured", [
  z.object({
    configured: z.literal(true),
    config: z.object({
      provider: AIProviderSchema,
      model: z.string().optional(),
    }),
  }),
  z.object({ configured: z.literal(false) }),
]);
export type ConfigCheckResponse = z.infer<typeof ConfigCheckResponseSchema>;

export const CurrentConfigResponseSchema = z.object({
  provider: AIProviderSchema,
  model: z.string().optional(),
});
export type CurrentConfigResponse = z.infer<typeof CurrentConfigResponseSchema>;

export const DeleteConfigResponseSchema = z.object({
  deleted: z.boolean(),
  warning: z.string().optional(),
});
export type DeleteConfigResponse = z.infer<typeof DeleteConfigResponseSchema>;

export const DeleteProviderCredentialsResponseSchema = z.object({
  deleted: z.boolean(),
  provider: AIProviderSchema,
});
export type DeleteProviderCredentialsResponse = z.infer<
  typeof DeleteProviderCredentialsResponseSchema
>;

export const ProviderStatusSchema = z.object({
  provider: AIProviderSchema,
  hasApiKey: z.boolean(),
  model: z.string().optional(),
  isActive: z.boolean(),
});
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

export const ProvidersStatusResponseSchema = z.object({
  providers: z.array(ProviderStatusSchema),
  activeProvider: AIProviderSchema.optional(),
});
export type ProvidersStatusResponse = z.infer<typeof ProvidersStatusResponseSchema>;

/** Server-side project info with trust config. @see cli/add/src/utils/detect.ts for the CLI detection variant. */
export const ProjectInfoSchema = z.object({
  path: z.string(),
  projectId: z.string().nullable(),
  trust: TrustConfigSchema.nullable(),
});
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;

export const ActivateProviderResponseSchema = z.object({
  provider: AIProviderSchema,
  model: z.string().optional(),
});
export type ActivateProviderResponse = z.infer<typeof ActivateProviderResponseSchema>;

const SETUP_FIELDS = ["secretsStorage", "provider", "model", "trust"] as const;
const SetupFieldSchema = z.enum(SETUP_FIELDS);
export type SetupField = z.infer<typeof SetupFieldSchema>;

export const SetupStatusSchema = z.object({
  hasSecretsStorage: z.boolean(),
  hasProvider: z.boolean(),
  hasModel: z.boolean(),
  hasTrust: z.boolean(),
  isConfigured: z.boolean(),
  isReady: z.boolean(),
  missing: z.array(SetupFieldSchema),
});
export type SetupStatus = z.infer<typeof SetupStatusSchema>;

export const InitResponseSchema = z.object({
  config: z
    .object({
      provider: AIProviderSchema,
      model: z.string().optional(),
    })
    .nullable(),
  settings: SettingsConfigSchema,
  providers: z.array(ProviderStatusSchema),
  configured: z.boolean(),
  project: ProjectInfoSchema,
  setup: SetupStatusSchema,
});
export type InitResponse = z.infer<typeof InitResponseSchema>;
