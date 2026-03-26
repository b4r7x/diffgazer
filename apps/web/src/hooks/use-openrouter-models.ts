import { useMemo } from "react";
import type { ModelInfo, AIProvider } from "@diffgazer/schemas/config";
import { useOpenRouterModels as useSharedOpenRouterModels } from "@diffgazer/api/hooks";
import { isOpenRouterCompatible, mapOpenRouterModels } from "@diffgazer/api";
import { OPENROUTER_PROVIDER_ID } from "@/config/constants";

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

export function useOpenRouterModels(open: boolean, provider: AIProvider): OpenRouterModelsState {
  const enabled = open && provider === OPENROUTER_PROVIDER_ID;
  const query = useSharedOpenRouterModels({ enabled });

  return useMemo(() => {
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
      (model) => (model.supportedParameters?.length ?? 0) > 0
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
  }, [enabled, query.isLoading, query.error, query.data]);
}
