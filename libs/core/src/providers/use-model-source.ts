import type { ModelInfo } from "../schemas/config/models.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import { READINESS_PRESENTATION } from "../schemas/config/readiness.js";
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

const MODEL_DISCOVERY_ERROR = "Model discovery failed. Test the configuration again.";
const MODEL_DISCOVERY_SKIPPED =
  "Model discovery was skipped. Complete the required prerequisites, then test again.";

const SAFE_MODEL_DISCOVERY_MESSAGES = new Set([
  "Model discovery returned a different configuration tuple.",
  "Model discovery acknowledgement did not match the current product notice.",
  "Model discovery did not prove an eligible exact model ID.",
  "The tested OpenRouter model is not an exact pinned downstream route.",
  "The configured local endpoint is unreachable.",
  "Live discovery prerequisites were unavailable.",
  "Compatibility evidence is unavailable for this installation.",
  ...Object.values(READINESS_PRESENTATION).map(
    ({ explanation, remediation }) => `${explanation} ${remediation.message}`,
  ),
]);

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function toClientSafeMessage(value: string, fallback: string): string {
  if (SAFE_MODEL_DISCOVERY_MESSAGES.has(value) && utf8ByteLength(value) <= 512) {
    return value;
  }
  return fallback;
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
        reason: toClientSafeMessage(source.reason, MODEL_DISCOVERY_SKIPPED),
      };
    case "error":
      return {
        ...source,
        models: [],
        error: toClientSafeMessage(source.error, MODEL_DISCOVERY_ERROR),
      };
  }
}
