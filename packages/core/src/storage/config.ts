import { paths } from "./paths.js";
import { createStorage, type StoreError } from "./json-store.js";
import { UserConfigSchema, type UserConfig } from "@repo/schemas/config";

export type ConfigError = StoreError;

const configStore = createStorage<UserConfig>({
  name: "config",
  filePath: paths.configFile,
  schema: UserConfigSchema,
});

export const configExists = configStore.exists;
export const readConfig = configStore.read;
export const writeConfig = configStore.write;
export const deleteConfig = configStore.remove;
