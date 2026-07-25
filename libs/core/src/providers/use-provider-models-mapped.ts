import { useProviderModels } from "../api/hooks/config.js";
import type { AIProvider, ModelInfo, ProviderModelsResponse } from "../schemas/config/index.js";
import { OPENROUTER_PROVIDER_ID } from "../schemas/config/index.js";

export interface ProviderModelsState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  source: ProviderModelsResponse["source"] | null;
  fetchedAt: string | null;
  retry: () => void;
}

const noop = () => {};
const EMPTY_STATE: ProviderModelsState = {
  models: [],
  loading: false,
  error: null,
  source: null,
  fetchedAt: null,
  retry: noop,
};

export function useProviderModelsMapped(open: boolean, provider: AIProvider): ProviderModelsState {
  // OpenRouter keeps its own key-scoped live path; this hook serves every other
  // provider from the models.dev-backed catalog route.
  const enabled = open && provider !== OPENROUTER_PROVIDER_ID;
  const query = useProviderModels(provider, { enabled });
  const retry = () => {
    void query.refetch();
  };

  if (!enabled) return EMPTY_STATE;
  // Prefer the last-good data over a transient refetch error: TanStack keeps the
  // previous models in `query.data` while `query.error` is set, so checking data
  // first stops a failed background refetch from blanking a working picker.
  if (query.data) {
    return {
      models: query.data.models,
      loading: false,
      error: null,
      source: query.data.source,
      fetchedAt: query.data.fetchedAt,
      retry,
    };
  }
  if (query.isLoading) return { ...EMPTY_STATE, loading: true, retry };
  if (query.error) return { ...EMPTY_STATE, error: query.error.message, retry };
  return { ...EMPTY_STATE, retry };
}
