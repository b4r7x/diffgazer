import { useReducer, useEffect } from "react";
import type { ModelInfo } from "@diffgazer/schemas/config";
import { api } from "@/lib/api";
import { OPENROUTER_PROVIDER_ID } from "@/config/constants";
import type { AIProvider } from "@diffgazer/schemas/config";

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

type Status = "idle" | "loading" | "loaded" | "error";

interface State {
  status: Status;
  models: ModelInfo[];
  total: number;
  compatible: number;
  hasParams: boolean;
  error: string | null;
}

type Action =
  | { type: "RESET" }
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: { models: ModelInfo[]; total: number; compatible: number; hasParams: boolean } }
  | { type: "FETCH_ERROR"; error: string };

const initialState: State = {
  status: "idle",
  models: [],
  total: 0,
  compatible: 0,
  hasParams: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, status: "loading", error: null };
    case "FETCH_SUCCESS":
      return { ...state, status: "loaded", ...action.payload };
    case "FETCH_ERROR":
      return { ...state, status: "error", error: action.error };
    case "RESET":
      return initialState;
  }
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
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!open || provider !== OPENROUTER_PROVIDER_ID) {
      dispatch({ type: "RESET" });
      return;
    }

    let cancelled = false;
    dispatch({ type: "FETCH_START" });

    api
      .getOpenRouterModels()
      .then((response) => {
        if (cancelled) return;
        const withParams = response.models.filter(
          (model) => (model.supportedParameters?.length ?? 0) > 0
        );
        const paramsAvailable = withParams.length > 0;
        const compatibleModels = paramsAvailable
          ? response.models.filter(isOpenRouterCompatible)
          : response.models;

        dispatch({
          type: "FETCH_SUCCESS",
          payload: {
            models: mapOpenRouterModels(compatibleModels),
            total: response.models.length,
            compatible: compatibleModels.length,
            hasParams: paramsAvailable,
          },
        });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({
          type: "FETCH_ERROR",
          error: err instanceof Error ? err.message : "Failed to load models",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, provider]);

  return {
    models: state.models,
    loading: state.status === "loading",
    error: state.error,
    total: state.total,
    compatible: state.compatible,
    hasParams: state.hasParams,
  };
}
