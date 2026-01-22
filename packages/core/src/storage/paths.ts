import { homedir } from "node:os";
import { join } from "node:path";
import { assertValidUuid } from "../validation.js";

export const APP_NAME = "stargazer";

function getAppHome(): string {
  return join(homedir(), `.${APP_NAME}`);
}

export const paths = {
  appHome: (): string => getAppHome(),
  config: (): string => getAppHome(),
  configFile: (): string => join(getAppHome(), "config.json"),
  secretsDir: (): string => join(getAppHome(), "secrets"),
  secretsFile: (): string => join(getAppHome(), "secrets", "secrets.json"),
  sessions: (): string => join(getAppHome(), "sessions"),
  sessionFile: (sessionId: string): string =>
    join(getAppHome(), "sessions", `${assertValidUuid(sessionId)}.json`),
  reviews: (): string => join(getAppHome(), "reviews"),
  reviewFile: (reviewId: string): string =>
    join(getAppHome(), "reviews", `${assertValidUuid(reviewId)}.json`),
} as const;
