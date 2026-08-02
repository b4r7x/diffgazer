import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  mapProviderList,
  PRODUCT_REGISTRY,
  projectClientMetadata,
} from "@diffgazer/core/providers";
import type {
  ClientConfigurationActionResponse,
  ClientConfigurationSummary,
  ConfigurationStatus,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import {
  READINESS_PRESENTATION,
  REMOVED_PRODUCT_ID,
  ReadinessSchema,
} from "@diffgazer/core/schemas/config";

export type SupportedConfigurationSummary = Extract<
  ClientConfigurationSummary,
  { status: "supported" }
>;

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

function readiness(
  status:
    | "ready"
    | "unconfigured"
    | "unsupported"
    | "local-endpoint-unreachable"
    | "removed"
    | "model-missing",
  productId: RunnableProductId = "gemini",
) {
  const presentation = READINESS_PRESENTATION[status];
  const notice = PRODUCT_REGISTRY[productId].notice;
  if (status === "ready") {
    return ReadinessSchema.parse({
      status,
      ready: true,
      evidenceStatus: "passed",
      checkedAt: "2026-07-31T12:00:00.000Z",
      acknowledgement: {
        status: "accepted",
        noticeId: notice.id,
        noticeVersion: notice.noticeVersion,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
      ...presentation,
    });
  }
  if (status === "model-missing" || status === "local-endpoint-unreachable") {
    return ReadinessSchema.parse({
      status,
      ready: false,
      evidenceStatus: "failed",
      checkedAt: "2026-07-31T12:00:00.000Z",
      acknowledgement: { status: "not-applicable" },
      ...presentation,
    });
  }
  return ReadinessSchema.parse({
    status,
    ready: false,
    evidenceStatus: "not-checked",
    checkedAt: null,
    acknowledgement: { status: "not-applicable" },
    ...presentation,
  });
}

function configurationStatus(
  configuration: ClientConfigurationSummary,
  readinessStatus: Parameters<typeof readiness>[0],
): ConfigurationStatus {
  const productId =
    configuration.status === "supported" ? configuration.productId : ("gemini" as const);
  return {
    configuration,
    readiness: readiness(readinessStatus, productId),
  };
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
} satisfies SupportedConfigurationSummary;

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
} satisfies SupportedConfigurationSummary;

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
} satisfies SupportedConfigurationSummary;

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
} satisfies SupportedConfigurationSummary;

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

export function geminiDiscoveryResponse(): Extract<
  ClientConfigurationActionResponse,
  { action: "test" }
> {
  return {
    action: "test",
    status: "succeeded",
    configuration: READY_GEMINI_CONFIGURATION,
    readiness: readiness("ready"),
  };
}

export function buildProviderRows(
  statuses: ConfigurationStatus[] = [
    configurationStatus(READY_GEMINI_CONFIGURATION, "ready"),
    configurationStatus(READY_ZAI_CONFIGURATION, "ready"),
    configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
    configurationStatus(CLI_UNSUPPORTED_CONFIGURATION, "unsupported"),
    configurationStatus(REMOVED_ZAI_CODING_CONFIGURATION, "removed"),
  ],
): ProviderListRow[] {
  return mapProviderList(statuses);
}

export function unconfiguredRow(productId: RunnableProductId): ProviderListRow {
  const product = PRODUCT_REGISTRY[productId];
  return projectClientMetadata({
    productId,
    configuration: null,
    readiness: readiness("unconfigured", productId),
    notices: [product.notice],
    actions: ["create"],
  });
}

export function makeConfigurationListResponse(
  statuses: ConfigurationStatus[] = [
    configurationStatus(READY_GEMINI_CONFIGURATION, "ready"),
    configurationStatus(READY_ZAI_CONFIGURATION, "ready"),
    configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
    configurationStatus(CLI_UNSUPPORTED_CONFIGURATION, "unsupported"),
    configurationStatus(REMOVED_ZAI_CODING_CONFIGURATION, "removed"),
  ],
) {
  return {
    schemaVersion: 2 as const,
    configurations: statuses,
    selectedConfigurationId: "gemini-primary" as const,
  };
}
