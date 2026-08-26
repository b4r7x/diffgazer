import { useQuery } from "@tanstack/react-query";
import { useApi } from "../api/hooks/context.js";
import { configurationModelsQuery } from "../api/hooks/queries/config.js";
import type { ConfigurationModelsResponse, ModelInfo } from "../schemas/config/models.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import {
  MODEL_DISCOVERY_ERROR_FALLBACK,
  MODEL_DISCOVERY_SKIPPED_FALLBACK,
  toClientSafeMessage,
} from "./model-discovery-messages.js";

interface ModelSourceIdentity {
  configurationId: ClientConfigurationSummary["configurationId"];
  productId: ClientConfigurationSummary["productId"];
  transportFamily: ClientConfigurationSummary["transportFamily"];
}

interface ModelSourceBase extends ModelSourceIdentity {
  models: ModelInfo[];
  retry: () => void;
}

type CatalogDiscoverySource = Extract<ConfigurationModelsResponse, { status: "passed" }>["source"];

export type ModelSourceState =
  | (ModelSourceBase & {
      status: "idle" | "loading";
      models: [];
      checkedAt: null;
      source: null;
      reason: null;
      error: null;
    })
  | (ModelSourceBase & {
      status: "passed";
      checkedAt: string;
      source: CatalogDiscoverySource;
      reason: null;
      error: null;
    })
  | (ModelSourceBase & {
      status: "skipped";
      models: [];
      checkedAt: string;
      source: null;
      reason: string;
      error: null;
    })
  | (ModelSourceBase & {
      status: "error";
      models: [];
      checkedAt: string | null;
      source: null;
      reason: null;
      error: string;
    });

function identity(configuration: ClientConfigurationSummary): ModelSourceIdentity {
  return {
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
  };
}

function emptyState(
  configuration: ClientConfigurationSummary,
  status: "idle" | "loading",
  retry: () => void,
): ModelSourceState {
  return {
    ...identity(configuration),
    status,
    models: [],
    checkedAt: null,
    source: null,
    reason: null,
    error: null,
    retry,
  };
}

export function useModelSource(
  open: boolean,
  configuration: ClientConfigurationSummary,
): ModelSourceState {
  const api = useApi();
  const query = useQuery({
    ...configurationModelsQuery(api, configuration),
    enabled: open,
    // Saving a selection bumps the configuration fingerprint (revision,
    // selectedModelId), which rotates the query key. Keep the discovered list
    // rendered while the same configuration refetches; a different
    // configuration must never inherit another one's models.
    placeholderData: (previousData) =>
      previousData?.configurationId === configuration.configurationId ? previousData : undefined,
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
      source: null,
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
      source: null,
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
      source: null,
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
    source: response.source,
    reason: null,
    error: null,
    retry,
  };
}
