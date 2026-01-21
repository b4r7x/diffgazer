import { paths } from "./paths.js";
import { createDocument, type StoreError } from "./persistence.js";
import { UserConfigSchema, type UserConfig } from "@repo/schemas/config";

export type ConfigError = StoreError;

export const configStore = createDocument<UserConfig>({
  name: "config",
  filePath: paths.configFile,
  schema: UserConfigSchema,
});
