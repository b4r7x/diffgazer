import { projectClientProduct } from "../providers/client-metadata.js";
import {
  mapProviderList,
  PRODUCT_REGISTRY,
  type ProviderListRow,
  projectClientMetadata,
} from "../providers/index.js";
import type {
  ClientConfigurationNotice,
  ClientConfigurationSummary,
  ConfigurationInitResponse,
  ConfigurationListResponse,
  ConfigurationStatus,
  Readiness,
  ReadinessAcknowledgement,
  ReadinessEvidenceStatus,
  ReadinessStatus,
  RunnableProductId,
  UnrecognizedConfiguration,
} from "../schemas/config/index.js";
import {
  ConfigurationInitResponseSchema,
  READINESS_PRESENTATION,
  ReadinessSchema,
} from "../schemas/config/index.js";

const FIXTURE_TIMESTAMP = "2026-07-31T12:00:00.000Z";

/**
 * The client notice a configuration carries, built by the same projection
 * production uses so fixtures cannot drift from the shipped conversion.
 */
export function makeClientNotice(productId: RunnableProductId): ClientConfigurationNotice {
  return projectClientProduct(productId).notice;
}

/**
 * Mirrors the server projection in `cli/server/src/shared/lib/config/readiness.ts`:
 * a missing or unsupported record carries no acknowledgement, an
 * `acknowledgement-required` record carries the unaccepted notice, and every
 * other status belongs to a configured record whose notice was accepted during
 * setup.
 */
function acknowledgementFor(
  status: ReadinessStatus,
  productId: ClientConfigurationSummary["productId"],
): ReadinessAcknowledgement {
  if (status === "unconfigured" || status === "unsupported") {
    return { status: "not-applicable" };
  }
  const notice = PRODUCT_REGISTRY[productId].notice;
  if (status === "acknowledgement-required") {
    return { status: "required", noticeId: notice.id, noticeVersion: notice.noticeVersion };
  }
  return {
    status: "accepted",
    noticeId: notice.id,
    noticeVersion: notice.noticeVersion,
    acceptedAt: FIXTURE_TIMESTAMP,
  };
}

function evidenceStatusFor(status: ReadinessStatus): ReadinessEvidenceStatus {
  if (status === "ready" || status === "acknowledgement-required") return "passed";
  if (status === "conformance-pending") return "pending";
  if (status === "skipped") return "skipped";
  if (status === "unconfigured" || status === "unsupported") return "not-checked";
  return "failed";
}

export function makeReadiness(
  status: ReadinessStatus,
  productId: ClientConfigurationSummary["productId"] = "gemini",
): Readiness {
  const evidenceStatus = evidenceStatusFor(status);
  return ReadinessSchema.parse({
    status,
    ready: status === "ready",
    evidenceStatus,
    checkedAt: evidenceStatus === "not-checked" ? null : FIXTURE_TIMESTAMP,
    acknowledgement: acknowledgementFor(status, productId),
    ...READINESS_PRESENTATION[status],
  });
}

export const GEMINI_CONFIGURATION = {
  configurationId: "gemini-primary",
  revision: 1,
  status: "supported",
  transportFamily: "hosted-api",
  productId: "gemini",
  endpoint: "https://generativelanguage.googleapis.com/v1beta",
  selectedModelId: "gemini-2.5-flash",
  notices: [makeClientNotice("gemini")],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} satisfies ClientConfigurationSummary;

export const ZAI_CONFIGURATION = {
  configurationId: "zai-primary",
  revision: 1,
  status: "supported",
  transportFamily: "hosted-api",
  productId: "zai",
  endpoint: "https://api.z.ai/api/paas/v4",
  selectedModelId: "glm-4.7",
  notices: [makeClientNotice("zai")],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} satisfies ClientConfigurationSummary;

export const OPENROUTER_CONFIGURATION = {
  configurationId: "openrouter-1",
  revision: 1,
  status: "supported",
  transportFamily: "hosted-api",
  productId: "openrouter",
  endpoint: "https://openrouter.ai/api/v1",
  selectedModelId: null,
  notices: [makeClientNotice("openrouter")],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} satisfies ClientConfigurationSummary;

export function configurationStatus(
  configuration: ClientConfigurationSummary,
  readinessStatus: ReadinessStatus,
): ConfigurationStatus {
  return {
    configuration,
    readiness: makeReadiness(readinessStatus, configuration.productId),
  };
}

/** Two ready configurations plus one still pending model selection. */
function representativeConfigurationStatuses(): ConfigurationStatus[] {
  return [
    configurationStatus(GEMINI_CONFIGURATION, "ready"),
    configurationStatus(ZAI_CONFIGURATION, "ready"),
    configurationStatus(OPENROUTER_CONFIGURATION, "model-missing"),
  ];
}

export function makeConfigurationInitResponse(
  statuses: ConfigurationStatus[],
  selectedConfigurationId: string | null = statuses[0]?.configuration.configurationId ?? null,
  unrecognizedConfigurations: UnrecognizedConfiguration[] = [],
): ConfigurationInitResponse {
  return ConfigurationInitResponseSchema.parse({
    schemaVersion: 2,
    configurations: statuses,
    unrecognizedConfigurations,
    selectedConfigurationId,
    settings: {
      theme: "terminal",
      defaultLenses: ["correctness"],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "parallel",
      // Consent is on record in the steady state; first-run tests override it.
      providerConsent: { version: 1, acceptedAt: "2026-08-01T09:00:00.000Z" },
    },
    project: { projectId: "proj-1", path: "/repo", trust: null },
  });
}

export function makeReadyInitResponse(): ConfigurationInitResponse {
  return makeConfigurationInitResponse([configurationStatus(GEMINI_CONFIGURATION, "ready")]);
}

export function makeConfigurationListResponse(
  init: ConfigurationInitResponse = makeReadyInitResponse(),
): ConfigurationListResponse {
  return {
    schemaVersion: 2,
    configurations: init.configurations,
    unrecognizedConfigurations: init.unrecognizedConfigurations,
    selectedConfigurationId: init.selectedConfigurationId,
  };
}

export function makeAllConfigurationsListResponse(): ConfigurationListResponse {
  return makeConfigurationListResponse(
    makeConfigurationInitResponse(representativeConfigurationStatuses()),
  );
}

export function buildProviderRows(
  statuses: ConfigurationStatus[] = representativeConfigurationStatuses(),
): ProviderListRow[] {
  return mapProviderList(statuses);
}

export function unconfiguredRow(productId: RunnableProductId): ProviderListRow {
  return projectClientMetadata({
    productId,
    configuration: null,
    readiness: makeReadiness("unconfigured", productId),
    notices: [makeClientNotice(productId)],
    actions: ["create"],
  });
}
