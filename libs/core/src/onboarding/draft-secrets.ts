import type { OnboardingDraft } from "./defaults.js";

/**
 * Drops literal credentials from a draft once the server owns them, so the
 * in-memory wizard state stops carrying write-only secrets after a save.
 */
export function scrubLiteralSecret(data: OnboardingDraft): OnboardingDraft {
  const configurationInput = { ...data.configurationInput };
  if (
    configurationInput.transportFamily === "hosted-api" &&
    configurationInput.credential?.kind === "literal"
  ) {
    delete configurationInput.credential;
  }
  if (
    configurationInput.transportFamily === "local-http" &&
    configurationInput.bearerToken?.kind === "literal"
  ) {
    delete configurationInput.bearerToken;
  }
  return { ...data, configurationInput };
}
