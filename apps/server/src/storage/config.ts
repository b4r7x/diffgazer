import { paths } from "./paths.js";
import { createDocument } from "./persistence.js";
import { UserConfigSchema, type UserConfig } from "@repo/schemas";

export const configStore = createDocument<UserConfig>({
  name: "config",
  filePath: paths.configFile,
  schema: UserConfigSchema,
});
