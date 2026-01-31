import type { AIProvider } from "@repo/schemas";

export const PROVIDER_ENV_VARS: Record<AIProvider, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  glm: "GLM_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export function getEnvVarForProvider(provider: AIProvider): { name: string; value: string | undefined } {
  const primaryName = PROVIDER_ENV_VARS[provider];
  const primaryValue = process.env[primaryName];

  // GLM supports ZHIPU_API_KEY as fallback
  if (provider === "glm" && !primaryValue) {
    const fallbackValue = process.env["ZHIPU_API_KEY"];
    if (fallbackValue) {
      return { name: "ZHIPU_API_KEY", value: fallbackValue };
    }
  }

  return { name: primaryName, value: primaryValue };
}
