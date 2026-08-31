import { createError } from "@diffgazer/core/errors";
import { isModelIdAllowedForProduct } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ClientConfigurationAction,
  ClientConfigurationActionResponse,
  ConfigurationId,
  ConfigurationInitResponse,
  ConfigurationListResponse,
  ConfigurationModelsResponse,
} from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  ConfigurationInitResponseSchema,
  ConfigurationListResponseSchema,
  ConfigurationModelsResponseSchema,
} from "@diffgazer/core/schemas/config";
import { discoverConfigurationCatalog } from "../../shared/lib/ai/models-dev-catalog/index.js";
import { getStore } from "../../shared/lib/config/store.js";
import type { ConfigurationActionError } from "../../shared/lib/config/types.js";

export type ConfigurationServiceError = ConfigurationActionError;

const projectSafeActionResponse = (
  action: ClientConfigurationAction,
  response: ClientConfigurationActionResponse,
): ClientConfigurationActionResponse =>
  ClientConfigurationActionResponseSchema.parse({ ...response, action: action.action });

// A malformed catalog entry must degrade to a mapped error, never a bare 500.
const projectModelsResponse = (
  payload: unknown,
): Result<ConfigurationModelsResponse, ConfigurationServiceError> => {
  const parsed = ConfigurationModelsResponseSchema.safeParse(payload);
  if (parsed.success) return ok(parsed.data);
  return err(
    createError<ConfigurationActionError["code"]>(
      "CONFIGURATION_UNSUPPORTED",
      "Model discovery response failed safe projection",
    ),
  );
};

export const runConfigurationAction = async (
  action: ClientConfigurationAction,
): Promise<Result<ClientConfigurationActionResponse, ConfigurationServiceError>> => {
  const result = await getStore().runConfigurationAction(action);
  if (!result.ok) return result;

  try {
    return ok(projectSafeActionResponse(action, result.value));
  } catch {
    return err(
      createError<ConfigurationActionError["code"]>(
        "CONFIGURATION_UNSUPPORTED",
        "Configuration response failed safe projection",
      ),
    );
  }
};

export const discoverConfigurationModels = async (
  configurationId: ConfigurationId,
): Promise<Result<ConfigurationModelsResponse, ConfigurationServiceError>> => {
  const inspected = await runConfigurationAction({ action: "inspect", configurationId });
  if (!inspected.ok) return inspected;

  const configuration = inspected.value.configuration;
  if (!configuration) {
    return err(
      createError<ConfigurationActionError["code"]>(
        "CONFIGURATION_UNSUPPORTED",
        "Model discovery requires a supported configuration",
      ),
    );
  }

  const discovery = await discoverConfigurationCatalog({
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    endpoint: configuration.endpoint,
  });
  const base = {
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    checkedAt: discovery.checkedAt,
  };
  if (discovery.status === "skipped") {
    return projectModelsResponse({
      ...base,
      status: "skipped",
      models: [],
      reason: discovery.reason,
    });
  }
  return projectModelsResponse({
    ...base,
    status: "passed",
    // Catalog discovery already applies this policy — that is what lets a
    // product whose whole offering is withheld report an explained skip instead
    // of a blank picker. Re-asserting it here is boundary defence over a payload
    // this response schema-validates anyway, not a second policy: both sites
    // call the one predicate, so neither can drift from the select and readiness
    // paths (higher-cost allowlist gates, reserved route segments).
    models: discovery.models.filter((model) =>
      isModelIdAllowedForProduct(configuration.productId, model.id),
    ),
    source: discovery.source,
    cached: discovery.cached,
  });
};

export const listConfigurations = async (): Promise<
  Result<ConfigurationListResponse, ConfigurationServiceError>
> => {
  const snapshot = await getStore().readConfigurationSnapshot();
  if (!snapshot.ok) return snapshot;

  return ok(
    ConfigurationListResponseSchema.parse({
      schemaVersion: 2,
      configurations: snapshot.value.configurations,
      unrecognizedConfigurations: snapshot.value.unrecognizedConfigurations,
      selectedConfigurationId: snapshot.value.selectedConfigurationId,
    }),
  );
};

export const getInitState = async (
  projectRoot?: string,
): Promise<Result<ConfigurationInitResponse, ConfigurationServiceError>> => {
  const store = getStore();
  const snapshot = await store.readConfigurationSnapshot();
  if (!snapshot.ok) return snapshot;

  return ok(
    ConfigurationInitResponseSchema.parse({
      schemaVersion: 2,
      ...snapshot.value,
      project: store.getProjectInfo(projectRoot),
    }),
  );
};
