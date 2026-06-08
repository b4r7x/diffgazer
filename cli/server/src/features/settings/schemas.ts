import { SettingsConfigSchema } from "@diffgazer/core/schemas/config";

export const SettingsSchema = SettingsConfigSchema.partial().refine(
  (settings) => settings.defaultLenses === undefined || settings.defaultLenses.length > 0,
  {
    path: ["defaultLenses"],
    message: "defaultLenses must not be empty",
  },
);
