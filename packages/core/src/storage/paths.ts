import { homedir } from "node:os";
import { join } from "node:path";
import { assertValidUuid } from "../utils/validation.js";

export const APP_NAME = "stargazer";

const APP_HOME = join(homedir(), `.${APP_NAME}`);

export const paths = {
  appHome: APP_HOME,
  config: APP_HOME,
  configFile: join(APP_HOME, "config.json"),
  secretsDir: join(APP_HOME, "secrets"),
  secretsFile: join(APP_HOME, "secrets", "secrets.json"),
  sessions: join(APP_HOME, "sessions"),
  sessionFile: (sessionId: string): string =>
    join(APP_HOME, "sessions", `${assertValidUuid(sessionId)}.json`),
  reviews: join(APP_HOME, "reviews"),
  reviewFile: (reviewId: string): string =>
    join(APP_HOME, "reviews", `${assertValidUuid(reviewId)}.json`),
  triageReviews: join(APP_HOME, "triage-reviews"),
  triageReviewFile: (reviewId: string): string =>
    join(APP_HOME, "triage-reviews", `${assertValidUuid(reviewId)}.json`),
} as const;
