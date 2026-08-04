import { useQuery } from "@tanstack/react-query";
import { useApi } from "../api/hooks/context.js";
import { configurationModelsQuery } from "../api/hooks/queries/config.js";
import type { ModelInfo } from "../schemas/config/models.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import {
  MODEL_DISCOVERY_ERROR_FALLBACK,
  MODEL_DISCOVERY_SKIPPED_FALLBACK,
  toClientSafeMessage,
} from "./model-discovery-messages.js";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;

interface ProviderModelsIdentity {
  configurationId: SupportedConfigurationSummary["configurationId"];
  productId: SupportedConfigurationSummary["productId"];
  transportFamily: SupportedConfigurationSummary["transportFamily"];
}

interface ProviderModelsStateBase extends ProviderModelsIdentity {
  models: ModelInfo[];
  retry: () => void;
}

export type ProviderModelsState =
  | (ProviderModelsStateBase & {
      status: "idle" | "loading";
      models: [];
      checkedAt: null;
      reason: null;
      error: null;
    })
  | (ProviderModelsStateBase & {
      status: "passed";
      checkedAt: string;
      reason: null;
      error: null;
    })
  | (ProviderModelsStateBase & {
      status: "skipped";
      models: [];
      checkedAt: string;
      reason: string;
      error: null;
    })
  | (ProviderModelsStateBase & {
      status: "error";
      models: [];
      checkedAt: string | null;
      reason: null;
      error: string;
    });

function identity(configuration: SupportedConfigurationSummary): ProviderModelsIdentity {
  return {
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
  };
}

function emptyState(
  configuration: SupportedConfigurationSummary,
  status: "idle" | "loading",
  retry: () => void,
): ProviderModelsState {
  return {
    ...identity(configuration),
    status,
    models: [],
    checkedAt: null,
    reason: null,
    error: null,
    retry,
  };
}

export function useProviderModelsMapped(
  open: boolean,
  configuration: SupportedConfigurationSummary,
): ProviderModelsState {
  const api = useApi();
  const query = useQuery({
    ...configurationModelsQuery(api, configuration),
    enabled: open,
  });
  const retry = () => {
    if (open) void query.refetch();
  };

  if (!open) return emptyState(configuration, "idle", retry);
  if (query.error) {
    return {
      ...identity(configuration),
      status: "error",
      models: [],
      checkedAt: null,
      reason: null,
      error: toClientSafeMessage(
        query.error instanceof Error ? query.error.message : undefined,
        MODEL_DISCOVERY_ERROR_FALLBACK,
      ),
      retry,
    };
  }
  if (query.isLoading) return emptyState(configuration, "loading", retry);
  if (!query.data) return emptyState(configuration, "idle", retry);

  const response = query.data;
  if (
    response.configurationId !== configuration.configurationId ||
    response.productId !== configuration.productId ||
    response.transportFamily !== configuration.transportFamily
  ) {
    return {
      ...identity(configuration),
      status: "error",
      models: [],
      checkedAt: response.checkedAt,
      reason: null,
      error: toClientSafeMessage(
        "Model discovery returned a different configuration tuple.",
        MODEL_DISCOVERY_ERROR_FALLBACK,
      ),
      retry,
    };
  }

  if (response.status === "skipped") {
    return {
      ...identity(configuration),
      status: "skipped",
      models: [],
      checkedAt: response.checkedAt,
      reason: toClientSafeMessage(response.reason, MODEL_DISCOVERY_SKIPPED_FALLBACK),
      error: null,
      retry,
    };
  }

  return {
    ...identity(configuration),
    status: "passed",
    models: response.models,
    checkedAt: response.checkedAt,
    reason: null,
    error: null,
    retry,
  };
}
