import { useProviderModels } from "../api/hooks/config.js";
import type { AIProvider, ModelInfo } from "../schemas/config/index.js";
import { OPENROUTER_PROVIDER_ID } from "../schemas/config/index.js";

export interface ProviderModelsState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: ProviderModelsState = {
  models: [],
  loading: false,
  error: null,
};

export function useProviderModelsMapped(
  open: boolean,
  provider: AIProvider,
): ProviderModelsState {
  // OpenRouter keeps its own key-scoped live path; this hook serves every other
  // provider from the models.dev-backed catalog route.
  const enabled = open && provider !== OPENROUTER_PROVIDER_ID;
  const query = useProviderModels(provider, { enabled });

  if (!enabled) return EMPTY_STATE;
  // Prefer the last-good data over a transient refetch error: TanStack keeps the
  // previous models in `query.data` while `query.error` is set, so checking data
  // first stops a failed background refetch from blanking a working picker.
  if (query.data) return { models: query.data.models, loading: false, error: null };
  if (query.isLoading) return { ...EMPTY_STATE, loading: true };
  if (query.error) return { ...EMPTY_STATE, error: query.error.message };
  return EMPTY_STATE;
}
