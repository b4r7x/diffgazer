import type { AIProvider } from "../schemas/config/index.js";
import { OPENROUTER_PROVIDER_ID } from "../schemas/config/index.js";
import { type ProviderModelsState, useProviderModelsMapped } from "./use-models-mapped.js";
import {
  type OpenRouterModelsState,
  useOpenRouterModelsMapped,
} from "./use-openrouter-models-mapped.js";

export interface ModelSourceState extends ProviderModelsState {
  /** True when the active provider is OpenRouter (compatibility UI gated on this). */
  isOpenRouter: boolean;
  /** Raw OpenRouter state, exposed so callers can render getCompatibilityLabel. */
  openRouter: OpenRouterModelsState;
}

/**
 * Single home for the provider→model-source merge: both underlying hooks
 * self-gate, so calling them unconditionally and branching on the provider id
 * yields the right models/loading/error without duplicating the decision at
 * every model picker.
 */
export function useModelSource(open: boolean, provider: AIProvider): ModelSourceState {
  const isOpenRouter = provider === OPENROUTER_PROVIDER_ID;
  const openRouter = useOpenRouterModelsMapped(open, provider);
  const catalog = useProviderModelsMapped(open, provider);
  const source = isOpenRouter ? openRouter : catalog;

  return {
    models: source.models,
    loading: source.loading,
    error: source.error,
    isOpenRouter,
    openRouter,
  };
}
