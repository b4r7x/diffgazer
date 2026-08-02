import { configurationFingerprint } from "@diffgazer/core/api/hooks";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationInitResponse,
  ConfigurationListResponse,
  ConfigurationStatus,
  ReadinessAcknowledgement,
  ReadinessStatus,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import {
  READINESS_PRESENTATION,
  REMOVED_PRODUCT_ID,
  ReadinessSchema,
} from "@diffgazer/core/schemas/config";

export { READINESS_PRESENTATION, ReadinessSchema };

function noticeSourceForProduct(
  productId: ClientConfigurationSummary["productId"],
): RunnableProductId {
  if (productId === REMOVED_PRODUCT_ID) return "zai";
  return productId;
}

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

function buildAcknowledgement(
  status: ReadinessStatus,
  notice: (typeof PRODUCT_REGISTRY)[RunnableProductId]["notice"],
): ReadinessAcknowledgement {
  if (status === "removed" || status === "unsupported") {
    return { status: "not-applicable" };
  }
  if (status === "ready") {
    return {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: "2026-07-31T12:00:00.000Z",
    };
  }
  return {
    status: "required",
    noticeId: notice.id,
    noticeVersion: notice.noticeVersion,
  };
}

function evidenceStatusForReadiness(status: ReadinessStatus): string {
  if (status === "ready") return "passed";
  if (status === "conformance-pending") return "pending";
  if (status === "skipped") return "skipped";
  if (status === "unsupported" || status === "removed" || status === "unconfigured") {
    return "not-checked";
  }
  return "failed";
}

export function makeReadiness(
  status: ReadinessStatus,
  productId: ClientConfigurationSummary["productId"] = "gemini",
) {
  const presentation = READINESS_PRESENTATION[status];
  const notice = PRODUCT_REGISTRY[noticeSourceForProduct(productId)].notice;
  const acknowledgement = buildAcknowledgement(status, notice);
  const evidenceStatus = evidenceStatusForReadiness(status);

  const checkedAt = evidenceStatus === "not-checked" ? null : "2026-07-31T12:00:00.000Z";

  return ReadinessSchema.parse({
    status,
    ready: status === "ready",
    evidenceStatus,
    checkedAt,
    acknowledgement,
    ...presentation,
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
} satisfies Extract<ClientConfigurationSummary, { status: "supported" }>;

export const LOCAL_OPENAI_CONFIGURATION: ClientConfigurationSummary = {
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
};

export const CLI_UNSUPPORTED_CONFIGURATION: ClientConfigurationSummary = {
  configurationId: "codex-cli-1",
  revision: 1,
  status: "supported",
  transportFamily: "local-cli",
  productId: "codex-cli",
  installationId: "codex-installation",
  selectedModelId: null,
  notices: [copyNotice("codex-cli")],
  availableActions: ["inspect", "select", "test", "update", "delete"],
};

export const REMOVED_ZAI_CODING_CONFIGURATION: ClientConfigurationSummary = {
  configurationId: "legacy-removed-zai-plan",
  revision: 4,
  status: "removed",
  transportFamily: "hosted-api",
  productId: REMOVED_PRODUCT_ID,
  selectedModelId: null,
  notices: [],
  availableActions: ["inspect", "delete"],
};

export function configurationStatus(
  configuration: ClientConfigurationSummary,
  readinessStatus: ReadinessStatus,
): ConfigurationStatus {
  return {
    configuration,
    readiness: makeReadiness(readinessStatus, configuration.productId),
  };
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

export function selectedIdentityFrom(configuration: ClientConfigurationSummary) {
  return {
    configurationId: configuration.configurationId,
    revision: configuration.revision,
    fingerprint: configurationFingerprint(configuration),
  };
}
