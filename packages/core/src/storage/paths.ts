import { homedir } from "node:os";
import { join } from "node:path";

const APP_NAME = "stargazer";

function getConfigHome(): string {
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

export const paths = {
  config: (): string => join(getConfigHome(), APP_NAME),
  configFile: (): string => join(getConfigHome(), APP_NAME, "config.json"),
  secretsDir: (): string => join(getConfigHome(), APP_NAME, "secrets"),
} as const;
