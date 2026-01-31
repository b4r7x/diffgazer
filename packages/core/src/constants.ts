import type { TrustCapabilities } from "@repo/schemas/settings";

export const APP_NAME = "stargazer";

/** Default TTL for in-memory caches (5 minutes) */
export const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Default trust capabilities for new projects.
 * Read operations are enabled by default, command execution is disabled for safety.
 */
export const DEFAULT_TRUST_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  readGit: true,
  runCommands: false,
};
