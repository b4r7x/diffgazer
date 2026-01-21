import { homedir } from "node:os";
import { join } from "node:path";
import { assertValidUuid } from "../validation.js";

const APP_NAME = "stargazer";

// Use ~/.stargazer/ for all app data (cross-platform)
function getAppHome(): string {
  return join(homedir(), `.${APP_NAME}`);
}

export const paths = {
  // Base directory
  appHome: (): string => getAppHome(),

  // Config
  config: (): string => getAppHome(),
  configFile: (): string => join(getAppHome(), "config.json"),

  // Secrets
  secretsDir: (): string => join(getAppHome(), "secrets"),

  // Sessions
  sessions: (): string => join(getAppHome(), "sessions"),
  sessionFile: (sessionId: string): string =>
    join(getAppHome(), "sessions", `${assertValidUuid(sessionId)}.json`),

  // Reviews
  reviews: (): string => join(getAppHome(), "reviews"),
  reviewFile: (reviewId: string): string =>
    join(getAppHome(), "reviews", `${assertValidUuid(reviewId)}.json`),
} as const;
