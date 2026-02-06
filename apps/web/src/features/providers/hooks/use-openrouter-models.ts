import { useState, useEffect } from "react";
import type { ModelInfo } from "@stargazer/schemas/config";
import { api } from "@/lib/api";
import { OPENROUTER_PROVIDER_ID } from "@/config/constants";
import type { AIProvider } from "@stargazer/schemas/config";

function isOpenRouterCompatible(model: {
  supportedParameters?: string[];
}): boolean {
  const params = model.supportedParameters ?? [];
  return params.includes("response_format") || params.includes("structured_outputs");
}

function mapOpenRouterModels(
  models: Array<{
    id: string;
    name: string;
    description?: string;
    isFree: boolean;
  }>
): ModelInfo[] {
  return models.map((model) => ({
    id: model.id,
    name: model.name || model.id,
    description: model.description ?? model.id,
    tier: model.isFree ? "free" : "paid",
  }));
}

export interface OpenRouterModelsState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  total: number;
  compatible: number;
  hasParams: boolean;
}

export function useOpenRouterModels(open: boolean, provider: AIProvider): OpenRouterModelsState {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [compatible, setCompatible] = useState(0);
  const [fetched, setFetched] = useState(false);
  const [hasParams, setHasParams] = useState(false);

  useEffect(() => {
    if (!open || provider !== OPENROUTER_PROVIDER_ID) return;
    if (fetched || loading) return;

    setLoading(true);
    setError(null);
    api
      .getOpenRouterModels()
      .then((response) => {
        const withParams = response.models.filter(
          (model) => (model.supportedParameters?.length ?? 0) > 0
        );
        const paramsAvailable = withParams.length > 0;
        const compatibleModels = paramsAvailable
          ? response.models.filter(isOpenRouterCompatible)
          : response.models;

        setTotal(response.models.length);
        setHasParams(paramsAvailable);
        setCompatible(compatibleModels.length);
        const mapped = mapOpenRouterModels(compatibleModels);
        setModels(mapped);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load models");
      })
      .finally(() => {
        setLoading(false);
        setFetched(true);
      });
  }, [open, provider, fetched, loading]);

  return { models, loading, error, total, compatible, hasParams };
}
