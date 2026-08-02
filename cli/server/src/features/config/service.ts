import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ClientConfigurationAction,
  ClientConfigurationActionResponse,
  ConfigurationId,
  ConfigurationInitResponse,
  ConfigurationListResponse,
  ConfigurationStatus,
} from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  ClientConfigurationInputSchema,
  ConfigurationInitResponseSchema,
  ConfigurationListResponseSchema,
} from "@diffgazer/core/schemas/config";
import { loadConfigV2 } from "../../shared/lib/config/persistence/config.js";
import type { DecodedProviderConfigurationRecord } from "../../shared/lib/config/provider-config.js";
import { getStore, setConfigurationLeaseHooks } from "../../shared/lib/config/store.js";
import type {
  ConfigDocumentV2,
  ConfigurationActionError,
  SecretsStorageError,
} from "../../shared/lib/config/types.js";

export { setConfigurationLeaseHooks };

export type ConfigurationServiceError = ConfigurationActionError;

const readFailure = (): SecretsStorageError =>
  createError("PERSIST_FAILED", "Failed to read configuration");

const configurationIdFromRecord = (
  record: DecodedProviderConfigurationRecord,
): ConfigurationId | null => {
  if (record.status === "supported" || record.status === "removed") {
    return record.record.configurationId;
  }
  return record.configurationId ?? null;
};

const projectSafeActionResponse = (
  action: ClientConfigurationAction,
  response: ClientConfigurationActionResponse,
): ClientConfigurationActionResponse =>
  ClientConfigurationActionResponseSchema.parse({ ...response, action: action.action });

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

  const configurations: ConfigurationStatus[] = [];
  for (const record of document.configurations) {
    const configurationId = configurationIdFromRecord(record);
    if (configurationId === null) {
      return err(
        createError<ConfigurationActionError["code"]>(
          "CONFIGURATION_UNSUPPORTED",
          "Configuration record is missing a configurationId",
        ),
      );
    }
    const status = await inspectConfigurationStatus(configurationId);
    if (!status.ok) return status;
    configurations.push(status.value);
  }

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
