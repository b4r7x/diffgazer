import { SecretsStorageSchema, SettingsConfigSchema } from "@diffgazer/core/schemas/config";

export const SettingsSchema = SettingsConfigSchema.partial().extend({
  secretsStorage: SecretsStorageSchema.optional(),
});
