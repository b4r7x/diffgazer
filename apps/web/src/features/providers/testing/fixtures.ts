import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  mapProviderList,
  PRODUCT_REGISTRY,
  projectClientMetadata,
} from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationStatus,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import {
  CLI_UNSUPPORTED_CONFIGURATION,
  configurationStatus,
  LOCAL_OPENAI_CONFIGURATION,
  makeReadiness,
  READY_GEMINI_CONFIGURATION,
  REMOVED_ZAI_CODING_CONFIGURATION,
} from "@/testing/configuration-fixtures";

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

export {
  CLI_UNSUPPORTED_CONFIGURATION,
  LOCAL_OPENAI_CONFIGURATION,
  READY_GEMINI_CONFIGURATION,
  REMOVED_ZAI_CODING_CONFIGURATION,
};

export const READY_ZAI_CONFIGURATION: Extract<ClientConfigurationSummary, { status: "supported" }> =
  {
    configurationId: "zai-primary",
    revision: 1,
    status: "supported",
    transportFamily: "hosted-api",
    productId: "zai",
    endpoint: "https://api.z.ai/api/paas/v4",
    selectedModelId: "glm-4.7",
    notices: [copyNotice("zai")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  };

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
  return projectClientMetadata({
    productId,
    configuration: null,
    readiness: makeReadiness("unconfigured", productId),
    notices: [copyNotice(productId)],
    actions: ["create"],
  });
}
