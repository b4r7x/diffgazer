import type { AIProvider } from "@repo/schemas/config";

export const PROVIDER_ENV_VARS: Record<AIProvider, string | null> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  glm: "ZHIPU_API_KEY",
} as const;

export const getEnvVarForProvider = (provider: AIProvider): string | null =>
  PROVIDER_ENV_VARS[provider] ?? null;
