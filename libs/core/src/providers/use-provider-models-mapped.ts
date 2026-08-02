import { useQuery } from "@tanstack/react-query";
import { useApi } from "../api/hooks/context.js";
import { CatalogSelectableModelIdSchema } from "../catalog/schema.js";
import type { ModelInfo, ModelTier } from "../schemas/config/models.js";
import {
  type ClientConfigurationSummary,
  ExactModelIdSchema,
} from "../schemas/config/provider-config.js";
import { READINESS_PRESENTATION, type Readiness } from "../schemas/config/readiness.js";
import { isModelIdAllowedForProduct, PRODUCT_REGISTRY } from "./product-registry.js";

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

const MODEL_DISCOVERY_ERROR_FALLBACK = "Model discovery failed. Test the configuration again.";
const MODEL_DISCOVERY_SKIPPED_FALLBACK =
  "Model discovery was skipped. Complete the required prerequisites, then test again.";

const SAFE_MODEL_DISCOVERY_MESSAGES = new Set([
  "Model discovery returned a different configuration tuple.",
  "Model discovery acknowledgement did not match the current product notice.",
  "Model discovery did not prove an eligible exact model ID.",
  ...Object.values(READINESS_PRESENTATION).map(
    ({ explanation, remediation }) => `${explanation} ${remediation.message}`,
  ),
]);

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Query failures and readiness strings cross into Web/Ink state here. Only
 * exact, bounded, registry-owned copy may cross that boundary; provider/CLI
 * output is never sanitized into a client message or persisted by this hook.
 */
function toClientSafeMessage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (utf8ByteLength(value) > 512 || !SAFE_MODEL_DISCOVERY_MESSAGES.has(value)) {
    return fallback;
  }
  return value;
}

function readinessMessage(status: Readiness["status"]): string {
  const presentation = READINESS_PRESENTATION[status];
  if (!presentation) return MODEL_DISCOVERY_ERROR_FALLBACK;
  return toClientSafeMessage(
    `${presentation.explanation} ${presentation.remediation.message}`,
    MODEL_DISCOVERY_ERROR_FALLBACK,
  );
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

function configurationTuple(configuration: SupportedConfigurationSummary) {
  const common = {
    configurationId: configuration.configurationId,
    revision: configuration.revision,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    selectedModelId: configuration.selectedModelId,
    notices: configuration.notices,
    availableActions: configuration.availableActions,
  };

  if (configuration.transportFamily === "hosted-api") {
    return {
      ...common,
      endpoint: configuration.endpoint,
      region: configuration.region ?? null,
      workspace: configuration.workspace ?? null,
    };
  }
  if (configuration.transportFamily === "local-http") {
    return {
      ...common,
      endpoint: configuration.endpoint,
      authentication: configuration.authentication,
      presetId: configuration.presetId ?? null,
    };
  }
  return { ...common, installationId: configuration.installationId };
}

function arraysMatch(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function noticesMatch(
  expected: SupportedConfigurationSummary["notices"],
  actual: ClientConfigurationSummary["notices"],
) {
  return (
    expected.length === actual.length &&
    expected.every((notice, index) => {
      const candidate = actual[index];
      return (
        candidate !== undefined &&
        candidate.id === notice.id &&
        candidate.noticeVersion === notice.noticeVersion &&
        candidate.acknowledgement === notice.acknowledgement &&
        candidate.acknowledgeBefore === notice.acknowledgeBefore &&
        candidate.renewAcknowledgementOn === notice.renewAcknowledgementOn &&
        arraysMatch(candidate.billing, notice.billing) &&
        arraysMatch(candidate.privacy, notice.privacy)
      );
    })
  );
}

function configurationMatches(
  expected: SupportedConfigurationSummary,
  actual: ClientConfigurationSummary,
  allowDiscoveredModel = false,
): boolean {
  const selectedModelMatches =
    actual.selectedModelId === expected.selectedModelId ||
    (allowDiscoveredModel && expected.selectedModelId === null && actual.selectedModelId !== null);
  if (
    actual.status !== "supported" ||
    actual.configurationId !== expected.configurationId ||
    actual.revision !== expected.revision ||
    actual.productId !== expected.productId ||
    actual.transportFamily !== expected.transportFamily ||
    !selectedModelMatches ||
    !arraysMatch(actual.availableActions, expected.availableActions) ||
    !noticesMatch(expected.notices, actual.notices)
  ) {
    return false;
  }

  if (expected.transportFamily === "hosted-api") {
    return (
      actual.transportFamily === "hosted-api" &&
      actual.endpoint === expected.endpoint &&
      (actual.region ?? null) === (expected.region ?? null) &&
      (actual.workspace ?? null) === (expected.workspace ?? null)
    );
  }
  if (expected.transportFamily === "local-http") {
    return (
      actual.transportFamily === "local-http" &&
      actual.endpoint === expected.endpoint &&
      actual.authentication === expected.authentication &&
      (actual.presetId ?? null) === (expected.presetId ?? null)
    );
  }
  return (
    actual.transportFamily === "local-cli" && actual.installationId === expected.installationId
  );
}

function modelMatchesProduct(
  modelId: string,
  productId: SupportedConfigurationSummary["productId"],
) {
  if (
    !ExactModelIdSchema.safeParse(modelId).success ||
    !CatalogSelectableModelIdSchema.safeParse(modelId).success
  ) {
    return false;
  }

  return isModelIdAllowedForProduct(productId, modelId);
}

function modelEvidenceDescription(
  transportFamily: SupportedConfigurationSummary["transportFamily"],
): string {
  switch (transportFamily) {
    case "hosted-api":
      return "Exact credentialed production-path evidence passed.";
    case "local-http":
      return "Exact loopback model-discovery evidence passed.";
    case "local-cli":
      return "Exact local CLI model-discovery evidence passed.";
  }
}

function modelTierFor(
  transportFamily: SupportedConfigurationSummary["transportFamily"],
): ModelTier {
  switch (transportFamily) {
    case "local-http":
      return "local";
    case "local-cli":
      return "ambient";
    case "hosted-api":
      // This branch is reached only after the exact hosted credential/route
      // evidence above has passed.  No local or ambient transport may inherit
      // a hosted billing label, and free is never inferred from a provider
      // brand or catalog observation.
      return "paid";
  }
}

function acknowledgementMatchesProduct(
  readiness: Readiness,
  productId: SupportedConfigurationSummary["productId"],
): boolean {
  if (readiness.status !== "ready" && readiness.status !== "acknowledgement-required") {
    return false;
  }

  const notice = PRODUCT_REGISTRY[productId].notice;
  const acknowledgement = readiness.acknowledgement;

  if (readiness.status === "ready") {
    return (
      acknowledgement.status === "accepted" &&
      acknowledgement.noticeId === notice.id &&
      acknowledgement.noticeVersion === notice.noticeVersion
    );
  }

  return (
    acknowledgement.status === "required" &&
    acknowledgement.noticeId === notice.id &&
    acknowledgement.noticeVersion === notice.noticeVersion
  );
}

export function useProviderModelsMapped(
  open: boolean,
  configuration: SupportedConfigurationSummary,
): ProviderModelsState {
  const api = useApi();
  const query = useQuery({
    queryKey: ["config", "configuration-models", configurationTuple(configuration)],
    queryFn: () => api.testConfiguration(configuration.configurationId),
    enabled: open,
    staleTime: 5 * 60_000,
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
      checkedAt: query.data?.readiness.checkedAt ?? null,
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

  const { readiness } = query.data;
  if (readiness.evidenceStatus === "skipped") {
    return {
      ...identity(configuration),
      status: "skipped",
      models: [],
      checkedAt: readiness.checkedAt,
      reason:
        readiness.status === "skipped"
          ? toClientSafeMessage(
              `${READINESS_PRESENTATION.skipped.explanation} ${READINESS_PRESENTATION.skipped.remediation.message}`,
              MODEL_DISCOVERY_SKIPPED_FALLBACK,
            )
          : MODEL_DISCOVERY_SKIPPED_FALLBACK,
      error: null,
      retry,
    };
  }
  const isModelDiscoveryEvidence =
    readiness.status === "ready" || readiness.status === "acknowledgement-required";
  if (
    query.data.status !== "succeeded" ||
    !isModelDiscoveryEvidence ||
    readiness.evidenceStatus !== "passed" ||
    readiness.checkedAt === null
  ) {
    return {
      ...identity(configuration),
      status: "error",
      models: [],
      checkedAt: readiness.checkedAt,
      reason: null,
      error:
        query.data.status === "succeeded"
          ? readinessMessage(readiness.status)
          : MODEL_DISCOVERY_ERROR_FALLBACK,
      retry,
    };
  }

  const testedConfiguration = query.data.configuration;
  if (
    !testedConfiguration ||
    testedConfiguration.status !== "supported" ||
    !configurationMatches(
      configuration,
      testedConfiguration,
      readiness.status === "acknowledgement-required",
    )
  ) {
    return {
      ...identity(configuration),
      status: "error",
      models: [],
      checkedAt: readiness.checkedAt,
      reason: null,
      error: toClientSafeMessage(
        "Model discovery returned a different configuration tuple.",
        MODEL_DISCOVERY_ERROR_FALLBACK,
      ),
      retry,
    };
  }
  if (!acknowledgementMatchesProduct(readiness, testedConfiguration.productId)) {
    return {
      ...identity(configuration),
      status: "error",
      models: [],
      checkedAt: readiness.checkedAt,
      reason: null,
      error: toClientSafeMessage(
        "Model discovery acknowledgement did not match the current product notice.",
        MODEL_DISCOVERY_ERROR_FALLBACK,
      ),
      retry,
    };
  }

  const modelId = testedConfiguration.selectedModelId;
  if (!modelId || !modelMatchesProduct(modelId, testedConfiguration.productId)) {
    return {
      ...identity(configuration),
      status: "error",
      models: [],
      checkedAt: readiness.checkedAt,
      reason: null,
      error: toClientSafeMessage(
        "Model discovery did not prove an eligible exact model ID.",
        MODEL_DISCOVERY_ERROR_FALLBACK,
      ),
      retry,
    };
  }

  return {
    ...identity(configuration),
    status: "passed",
    models: [
      {
        id: modelId,
        name: modelId,
        description: modelEvidenceDescription(testedConfiguration.transportFamily),
        tier: modelTierFor(testedConfiguration.transportFamily),
      },
    ],
    checkedAt: readiness.checkedAt,
    reason: null,
    error: null,
    retry,
  };
}
