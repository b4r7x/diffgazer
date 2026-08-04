import { configurationFingerprint } from "../api/hooks/index.js";
import {
  mapProviderList,
  PRODUCT_REGISTRY,
  type ProviderListRow,
  projectClientMetadata,
} from "../providers/index.js";
import type {
  ClientConfigurationSummary,
  ConfigurationInitResponse,
  ConfigurationListResponse,
  ConfigurationStatus,
  Readiness,
  ReadinessAcknowledgement,
  ReadinessEvidenceStatus,
  ReadinessStatus,
  RunnableProductId,
} from "../schemas/config/index.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "../schemas/config/index.js";

const FIXTURE_TIMESTAMP = "2026-07-31T12:00:00.000Z";

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
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

export const READY_GEMINI_CONFIGURATION = {
  configurationId: "gemini-primary",
  revision: 1,
  status: "supported",
  transportFamily: "hosted-api",
  productId: "gemini",
  endpoint: "https://generativelanguage.googleapis.com/v1beta",
  selectedModelId: "gemini-2.5-flash",
  notices: [copyNotice("gemini")],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} satisfies ClientConfigurationSummary;

export const READY_ZAI_CONFIGURATION = {
  configurationId: "zai-primary",
  revision: 1,
  status: "supported",
  transportFamily: "hosted-api",
  productId: "zai",
  endpoint: "https://api.z.ai/api/paas/v4",
  selectedModelId: "glm-4.7",
  notices: [copyNotice("zai")],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} satisfies ClientConfigurationSummary;

export const LOCAL_OPENAI_CONFIGURATION = {
  configurationId: "local-openai-1",
  revision: 1,
  status: "supported",
  transportFamily: "local-http",
  productId: "local-openai",
  endpoint: "http://127.0.0.1:1234/v1",
  authentication: "none",
  presetId: "lm-studio",
  selectedModelId: null,
  notices: [copyNotice("local-openai")],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} satisfies ClientConfigurationSummary;

export const CLI_UNSUPPORTED_CONFIGURATION = {
  configurationId: "codex-cli-1",
  revision: 1,
  status: "supported",
  transportFamily: "local-cli",
  productId: "codex-cli",
  installationId: "codex-installation",
  selectedModelId: null,
  notices: [copyNotice("codex-cli")],
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

/** One configuration per supported transport family. */
function allConfigurationStatuses(): ConfigurationStatus[] {
  return [
    configurationStatus(READY_GEMINI_CONFIGURATION, "ready"),
    configurationStatus(READY_ZAI_CONFIGURATION, "ready"),
    configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
    configurationStatus(CLI_UNSUPPORTED_CONFIGURATION, "unsupported"),
  ];
}

export function makeConfigurationInitResponse(
  statuses: ConfigurationStatus[],
  selectedConfigurationId: string | null = statuses[0]?.configuration.configurationId ?? null,
): ConfigurationInitResponse {
  return {
    schemaVersion: 2,
    configurations: statuses,
    selectedConfigurationId,
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "parallel",
    },
    project: { projectId: "proj-1", path: "/repo", trust: null },
  };
}

export function makeReadyInitResponse(): ConfigurationInitResponse {
  return makeConfigurationInitResponse([configurationStatus(READY_GEMINI_CONFIGURATION, "ready")]);
}

export function makeNonReadyInitResponse(): ConfigurationInitResponse {
  return makeConfigurationInitResponse(
    [
      configurationStatus(READY_GEMINI_CONFIGURATION, "ready"),
      configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
    ],
    "local-openai-1",
  );
}

export function makeConfigurationListResponse(
  init: ConfigurationInitResponse = makeReadyInitResponse(),
): ConfigurationListResponse {
  return {
    schemaVersion: 2,
    configurations: init.configurations,
    selectedConfigurationId: init.selectedConfigurationId,
  };
}

export function makeAllConfigurationsListResponse(): ConfigurationListResponse {
  return makeConfigurationListResponse(makeConfigurationInitResponse(allConfigurationStatuses()));
}

export function selectedIdentityFrom(configuration: ClientConfigurationSummary) {
  return {
    configurationId: configuration.configurationId,
    revision: configuration.revision,
    fingerprint: configurationFingerprint(configuration),
  };
}

export function buildProviderRows(
  statuses: ConfigurationStatus[] = allConfigurationStatuses(),
): ProviderListRow[] {
  return mapProviderList(statuses);
}

export function unconfiguredRow(productId: RunnableProductId): ProviderListRow {
  return projectClientMetadata({
    productId,
    configuration: null,
    readiness: makeReadiness("unconfigured", productId),
    notices: [copyNotice(productId)],
    actions: ["create"],
  });
}
