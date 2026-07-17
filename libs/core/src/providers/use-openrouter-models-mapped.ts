import { useOpenRouterModels } from "../api/hooks/config.js";
import { isOpenRouterCompatible, mapOpenRouterModels } from "../api/openrouter.js";
import type { AIProvider, ModelInfo } from "../schemas/config/index.js";
import { OPENROUTER_PROVIDER_ID } from "../schemas/config/index.js";

export interface OpenRouterModelsState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  total: number;
  compatible: number;
  hasParams: boolean;
  retry: () => void;
}

export function getCompatibilityLabel({
  total,
  compatible,
  hasParams,
}: Pick<OpenRouterModelsState, "total" | "compatible" | "hasParams">): string {
  if (total === 0) return "No models available.";
  if (compatible < total) {
    return `Showing ${compatible}/${total} models that support structured outputs.`;
  }
  if (hasParams) return "Showing models that support structured outputs.";
  return "Compatibility unknown; showing all models.";
}

const EMPTY_STATE: OpenRouterModelsState = {
  models: [],
  loading: false,
  error: null,
  total: 0,
  compatible: 0,
  hasParams: false,
  retry: () => {},
};

export function useOpenRouterModelsMapped(
  open: boolean,
  provider: AIProvider,
): OpenRouterModelsState {
  const enabled = open && provider === OPENROUTER_PROVIDER_ID;
  const query = useOpenRouterModels({ enabled });
  const retry = () => {
    void query.refetch();
  };

  if (!enabled) return EMPTY_STATE;

  const response = query.data;
  if (!response) {
    if (query.isLoading) {
      return { ...EMPTY_STATE, loading: true, retry };
    }

    if (query.error) {
      return { ...EMPTY_STATE, error: query.error.message, retry };
    }

    return { ...EMPTY_STATE, retry };
  }

  const withParams = response.models.filter(
    (model) => (model.supportedParameters?.length ?? 0) > 0,
  );
  const paramsAvailable = withParams.length > 0;
  const compatibleModels = paramsAvailable
    ? response.models.filter(isOpenRouterCompatible)
    : response.models;

  return {
    models: mapOpenRouterModels(compatibleModels),
    loading: false,
    error: null,
    total: response.models.length,
    compatible: compatibleModels.length,
    hasParams: paramsAvailable,
    retry,
  };
}
