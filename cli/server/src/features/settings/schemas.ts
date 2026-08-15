import { SettingsConfigSchema } from "@diffgazer/core/schemas/config";

// Mirrors the published `Partial<SettingsConfig>` client payload exactly, so a
// null `secretsStorage` reaches `updateSettings` and gets its designed
// STORAGE_NOT_CONFIGURED remediation instead of a generic Zod 400.
export const SettingsSchema = SettingsConfigSchema.partial();
