import { PROVIDER_ENV_VARS, type AIProvider } from "@stargazer/schemas/config";

export { PROVIDER_ENV_VARS };

export const getEnvVarForProvider = (provider: AIProvider): string | null =>
  PROVIDER_ENV_VARS[provider] ?? null;
