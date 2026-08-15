import type { RunnableProductId } from "../schemas/config/transports.js";

export type ProviderOverlay = {
  readonly modelsDevIds: readonly string[];
};

export const PROVIDER_OVERLAY: Partial<Record<RunnableProductId, ProviderOverlay>> = {
  gemini: { modelsDevIds: ["google"] },
  zai: { modelsDevIds: ["zai"] },
  openrouter: { modelsDevIds: ["openrouter"] },
  groq: { modelsDevIds: ["groq"] },
  cerebras: { modelsDevIds: ["cerebras"] },
  mistral: { modelsDevIds: ["mistral"] },
};
