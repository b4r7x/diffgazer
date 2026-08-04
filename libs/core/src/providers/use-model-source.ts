import type { ModelInfo } from "../schemas/config/models.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import {
  MODEL_DISCOVERY_ERROR_FALLBACK,
  MODEL_DISCOVERY_SKIPPED_FALLBACK,
  toClientSafeMessage,
} from "./model-discovery-messages.js";
import { useProviderModelsMapped } from "./use-provider-models-mapped.js";

export type SupportedConfigurationSummary = Extract<
  ClientConfigurationSummary,
  { status: "supported" }
>;

interface ModelSourceIdentity {
  configurationId: SupportedConfigurationSummary["configurationId"];
  productId: SupportedConfigurationSummary["productId"];
  transportFamily: SupportedConfigurationSummary["transportFamily"];
}

interface ModelSourceBase extends ModelSourceIdentity {
  models: ModelInfo[];
  retry: () => void;
}

export type ModelSourceState =
  | (ModelSourceBase & {
      status: "idle" | "loading";
      models: [];
      checkedAt: null;
      reason: null;
      error: null;
    })
  | (ModelSourceBase & {
      status: "passed";
      checkedAt: string;
      reason: null;
      error: null;
    })
  | (ModelSourceBase & {
      status: "skipped";
      models: [];
      checkedAt: string;
      reason: string;
      error: null;
    })
  | (ModelSourceBase & {
      status: "error";
      models: [];
      checkedAt: string | null;
      reason: null;
      error: string;
    });

function emptyState(
  configuration: SupportedConfigurationSummary,
  status: "idle" | "loading",
  retry: () => void,
): ModelSourceState {
  return {
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    status,
    models: [],
    checkedAt: null,
    reason: null,
    error: null,
    retry,
  };
}

function identityMatches(
  source: ModelSourceIdentity,
  configuration: SupportedConfigurationSummary,
): boolean {
  return (
    source.configurationId === configuration.configurationId &&
    source.productId === configuration.productId &&
    source.transportFamily === configuration.transportFamily
  );
}

export function useModelSource(
  open: boolean,
  configuration: SupportedConfigurationSummary,
): ModelSourceState {
  const source: ModelSourceState = useProviderModelsMapped(open, configuration);

  if (!open) return emptyState(configuration, "idle", source.retry);
  if (!identityMatches(source, configuration)) {
    return {
      configurationId: configuration.configurationId,
      productId: configuration.productId,
      transportFamily: configuration.transportFamily,
      status: "error",
      models: [],
      checkedAt: null,
      reason: null,
      error: "Model discovery returned a different configuration identity.",
      retry: source.retry,
    };
  }
  switch (source.status) {
    case "passed":
      return source;
    case "loading":
      return emptyState(configuration, "loading", source.retry);
    case "idle":
      return emptyState(configuration, "idle", source.retry);
    case "skipped":
      return {
        ...source,
        models: [],
        reason: toClientSafeMessage(source.reason, MODEL_DISCOVERY_SKIPPED_FALLBACK),
      };
    case "error":
      return {
        ...source,
        models: [],
        error: toClientSafeMessage(source.error, MODEL_DISCOVERY_ERROR_FALLBACK),
      };
  }
}
