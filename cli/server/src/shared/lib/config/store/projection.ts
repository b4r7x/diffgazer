import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  type ClientConfigurationActionName,
  type ClientConfigurationActionResponse,
  ClientConfigurationActionResponseSchema,
  type ClientConfigurationNotice,
  ClientConfigurationNoticeSchema,
  type ClientConfigurationSummary,
  ClientConfigurationSummarySchema,
  type Readiness,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import type { SupportedProviderConfigurationRecord } from "../provider-config.js";
import { type ConfigurationActionError, configurationActionFailure } from "../types.js";

const SUPPORTED_CONFIGURATION_ACTIONS: readonly ClientConfigurationActionName[] = [
  "inspect",
  "select",
  "test",
  "update",
  "delete",
];

function noticesFor(productId: RunnableProductId): readonly ClientConfigurationNotice[] | null {
  const parsed = ClientConfigurationNoticeSchema.safeParse({
    ...PRODUCT_REGISTRY[productId].notice,
  });
  return parsed.success ? [parsed.data] : null;
}

export function summaryForSupportedRecord(
  record: SupportedProviderConfigurationRecord,
): Result<ClientConfigurationSummary, ConfigurationActionError> {
  const notices = noticesFor(record.productId);
  if (!notices)
    return err(
      configurationActionFailure(
        "CONFIGURATION_UNSUPPORTED",
        "Configuration cannot be represented at the client boundary",
      ),
    );
  const base = {
    configurationId: record.configurationId,
    revision: record.revision,
    selectedModelId: record.selectedModelId,
    notices,
    availableActions: SUPPORTED_CONFIGURATION_ACTIONS,
  };
  const input = record.input;
  let candidate: unknown;
  if (input.transportFamily === "hosted-api") {
    candidate = {
      status: "supported",
      transportFamily: "hosted-api",
      productId: record.productId,
      endpoint: input.endpoint,
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.workspace !== undefined ? { workspace: input.workspace } : {}),
      ...base,
    };
  } else if (input.transportFamily === "local-http") {
    candidate = {
      status: "supported",
      transportFamily: "local-http",
      productId: record.productId,
      endpoint: input.endpoint,
      authentication: input.authentication,
      ...(input.presetId !== undefined ? { presetId: input.presetId } : {}),
      ...base,
    };
  } else {
    candidate = {
      status: "supported",
      transportFamily: "local-cli",
      productId: record.productId,
      installationId: input.installationId,
      ...base,
    };
  }
  const parsed = ClientConfigurationSummarySchema.safeParse(candidate);
  return parsed.success
    ? ok(parsed.data)
    : err(
        configurationActionFailure(
          "CONFIGURATION_UNSUPPORTED",
          "Configuration cannot be represented at the client boundary",
        ),
      );
}

export function succeededActionResponse<Action extends ClientConfigurationActionName>(
  action: Action,
  payload: { configuration?: ClientConfigurationSummary; readiness?: Readiness } = {},
): ClientConfigurationActionResponse {
  return ClientConfigurationActionResponseSchema.parse({
    action,
    status: "succeeded",
    ...(payload.configuration !== undefined ? { configuration: payload.configuration } : {}),
    ...(payload.readiness !== undefined ? { readiness: payload.readiness } : {}),
  });
}
