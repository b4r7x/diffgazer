import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { isModelIdAllowedForProduct } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ClientConfigurationAction,
  ClientConfigurationActionResponse,
  ConfigurationId,
  ConfigurationInitResponse,
  ConfigurationListResponse,
  ConfigurationModelsResponse,
  ConfigurationStatus,
} from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  ClientConfigurationInputSchema,
  ConfigurationInitResponseSchema,
  ConfigurationListResponseSchema,
  ConfigurationModelsResponseSchema,
} from "@diffgazer/core/schemas/config";
import { discoverConfigurationCatalog } from "../../shared/lib/ai/models-dev-catalog.js";
import { loadConfigV2 } from "../../shared/lib/config/persistence/config.js";
import type { DecodedProviderConfigurationRecord } from "../../shared/lib/config/provider-config.js";
import { getStore } from "../../shared/lib/config/store.js";
import type {
  ConfigDocumentV2,
  ConfigurationActionError,
  SecretsStorageError,
} from "../../shared/lib/config/types.js";
import { log } from "../../shared/lib/log.js";

export type ConfigurationServiceError = ConfigurationActionError;

const readFailure = (): SecretsStorageError =>
  createError("PERSIST_FAILED", "Failed to read configuration");

const configurationIdFromRecord = (
  record: DecodedProviderConfigurationRecord,
): ConfigurationId | null => {
  if (record.status === "supported") return record.record.configurationId;
  return record.configurationId ?? null;
};

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

const validateWritableInput = (
  action: Extract<ClientConfigurationAction, { action: "create" | "update" }>,
): Result<void, ConfigurationActionError> => {
  const parsed = ClientConfigurationInputSchema.safeParse(action.input);
  if (!parsed.success) {
    return err(
      createError<ConfigurationActionError["code"]>(
        "INVALID_ACTION",
        "Invalid configuration input",
      ),
    );
  }
  return ok(undefined);
};

export const runConfigurationAction = async (
  action: ClientConfigurationAction,
): Promise<Result<ClientConfigurationActionResponse, ConfigurationServiceError>> => {
  if (action.action === "create" || action.action === "update") {
    const validation = validateWritableInput(action);
    if (!validation.ok) return validation;
  }

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

const inspectConfigurationStatus = async (
  configurationId: ConfigurationId,
): Promise<Result<ConfigurationStatus, ConfigurationServiceError>> => {
  const result = await runConfigurationAction({ action: "inspect", configurationId });
  if (!result.ok) return result;
  if (!result.value.configuration || !result.value.readiness) {
    return err(
      createError<ConfigurationActionError["code"]>(
        "CONFIGURATION_UNSUPPORTED",
        "Configuration inspect response is incomplete",
      ),
    );
  }
  return ok({
    configuration: result.value.configuration,
    readiness: result.value.readiness,
  });
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
    // Filter server-side so the picker never offers a model the select and
    // readiness paths would reject (opt-in suffixes, reserved route segments).
    models: discovery.models.filter((model) =>
      isModelIdAllowedForProduct(configuration.productId, model.id),
    ),
    source: discovery.source,
    cached: discovery.cached,
  });
};

/**
 * A record the store cannot inspect degrades to a dropped row, not a blank
 * document: the record union already models per-row failure, and both
 * `/api/config/providers` and `/api/config/init` are read at app startup, so one
 * unreadable record must not take the whole surface down with it. The reason
 * stays in the server log — `ConfigurationStatus` requires a client summary the
 * store could not project, so there is nothing safe to put in the row.
 */
const inspectListRow = async (
  record: DecodedProviderConfigurationRecord,
): Promise<ConfigurationStatus | null> => {
  const configurationId = configurationIdFromRecord(record);
  if (configurationId === null) {
    log("warn", "config_list_record_skipped", { reason: "missing configurationId" });
    return null;
  }
  try {
    const status = await inspectConfigurationStatus(configurationId);
    if (status.ok) return status.value;
    log("warn", "config_list_record_skipped", { configurationId, reason: status.error.code });
    return null;
  } catch (cause) {
    log("warn", "config_list_record_skipped", {
      configurationId,
      reason: getErrorMessage(cause),
    });
    return null;
  }
};

export const listConfigurations = async (): Promise<
  Result<ConfigurationListResponse, SecretsStorageError | ConfigurationServiceError>
> => {
  const store = getStore();
  const readyResult = await store.ready();
  if (!readyResult.ok) return readyResult;

  let document: ConfigDocumentV2;
  try {
    document = loadConfigV2();
  } catch {
    return err(readFailure());
  }

  const inspected = await Promise.all(document.configurations.map(inspectListRow));
  const configurations = inspected.filter((row) => row !== null);

  return ok(
    ConfigurationListResponseSchema.parse({
      schemaVersion: 2,
      configurations,
      selectedConfigurationId: document.selectedConfigurationId,
    }),
  );
};

export const getInitState = async (
  projectRoot?: string,
): Promise<Result<ConfigurationInitResponse, SecretsStorageError | ConfigurationServiceError>> => {
  const listResult = await listConfigurations();
  if (!listResult.ok) return listResult;

  const store = getStore();
  return ok(
    ConfigurationInitResponseSchema.parse({
      ...listResult.value,
      settings: store.getSettings(),
      project: store.getProjectInfo(projectRoot),
    }),
  );
};
