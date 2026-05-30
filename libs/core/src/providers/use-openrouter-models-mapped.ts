import type { ModelInfo, AIProvider } from "@diffgazer/core/schemas/config";
import { OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import { useOpenRouterModels } from "../api/hooks/config";
import { isOpenRouterCompatible, mapOpenRouterModels } from "../api/openrouter-utils";

export interface OpenRouterModelsState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  total: number;
  compatible: number;
  hasParams: boolean;
}

const EMPTY_STATE: OpenRouterModelsState = {
  models: [],
  loading: false,
  error: null,
  total: 0,
  compatible: 0,
  hasParams: false,
};

export function useOpenRouterModelsMapped(
  open: boolean,
  provider: AIProvider,
): OpenRouterModelsState {
  const enabled = open && provider === OPENROUTER_PROVIDER_ID;
  const query = useOpenRouterModels({ enabled });

  if (!enabled) return EMPTY_STATE;

  if (query.isLoading) {
    return { ...EMPTY_STATE, loading: true };
  }

  if (query.error) {
    return { ...EMPTY_STATE, error: query.error.message };
  }

  const response = query.data;
  if (!response) return EMPTY_STATE;

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
  };
}
