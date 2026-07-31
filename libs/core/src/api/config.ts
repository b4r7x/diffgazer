import type {
  ClientConfigurationAction,
  ClientConfigurationActionResponse,
  ClientConfigurationInput,
  ConfigurationId,
  ConfigurationRevision,
  ExactModelId,
} from "../schemas/config/provider-config.js";
import { ClientConfigurationActionResponseSchema } from "../schemas/config/provider-config.js";
import type {
  ConfigurationInitResponse,
  ConfigurationListResponse,
} from "../schemas/config/providers.js";
import {
  ConfigurationInitResponseSchema,
  ConfigurationListResponseSchema,
} from "../schemas/config/providers.js";
import type { ReadinessAcknowledgement } from "../schemas/config/readiness.js";
import type { ApiClient } from "./types.js";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;
type ConfigurationActionName = ClientConfigurationAction["action"];
type ConfigurationActionResponse<Action extends ConfigurationActionName> = Extract<
  ClientConfigurationActionResponse,
  { action: Action }
>;

function parseBoundConfigurationActionResponse<Action extends ClientConfigurationAction>(
  action: Action,
  body: unknown,
): ConfigurationActionResponse<Action["action"]> {
  const response = ClientConfigurationActionResponseSchema.parse(body);
  if (response.action !== action.action) {
    throw new Error(
      `Configuration action response mismatch: expected ${action.action}, received ${response.action}`,
    );
  }

  const configuration = response.configuration;
  if (configuration && action.action !== "create") {
    if (configuration.configurationId !== action.configurationId) {
      throw new Error("Configuration action response belongs to a different configuration");
    }
  }

  if (response.status === "succeeded") {
    if (action.action === "create" && configuration?.status !== "supported") {
      throw new Error("A successful create response must contain a supported configuration");
    }
    if (
      (action.action === "select" || action.action === "test" || action.action === "update") &&
      configuration?.status !== "supported"
    ) {
      throw new Error(
        `A successful ${action.action} response must contain a supported configuration`,
      );
    }
    if (action.action === "select" && configuration?.selectedModelId !== action.modelId) {
      throw new Error("Configuration action response selected a different model");
    }
    if (
      action.action === "update" &&
      configuration !== undefined &&
      configuration.revision < action.expectedRevision
    ) {
      throw new Error("Configuration action response returned a stale revision");
    }
    if (
      action.action === "delete" &&
      configuration !== undefined &&
      configuration.status === "supported"
    ) {
      throw new Error("A successful delete response cannot contain a supported configuration");
    }
    if (
      action.action === "delete" &&
      configuration !== undefined &&
      configuration.revision < action.expectedRevision
    ) {
      throw new Error("Configuration delete response returned a stale revision");
    }
  }

  return response as ConfigurationActionResponse<Action["action"]>;
}

export async function executeConfigurationAction<Action extends ClientConfigurationAction>(
  client: ApiClient,
  action: Action,
): Promise<ConfigurationActionResponse<Action["action"]>> {
  const response = await client.post<ClientConfigurationActionResponse>(
    "/api/config/actions",
    action,
    { schema: (body) => parseBoundConfigurationActionResponse(action, body) },
  );
  return parseBoundConfigurationActionResponse(action, response);
}

export function createConfiguration(client: ApiClient, input: ClientConfigurationInput) {
  return executeConfigurationAction(client, { action: "create", input });
}

export function inspectConfiguration(client: ApiClient, configurationId: ConfigurationId) {
  return executeConfigurationAction(client, { action: "inspect", configurationId });
}

export function selectConfiguration(
  client: ApiClient,
  configurationId: ConfigurationId,
  modelId: ExactModelId,
) {
  return executeConfigurationAction(client, { action: "select", configurationId, modelId });
}

export function testConfiguration(client: ApiClient, configurationId: ConfigurationId) {
  return executeConfigurationAction(client, { action: "test", configurationId });
}

export function updateConfiguration(
  client: ApiClient,
  configurationId: ConfigurationId,
  expectedRevision: ConfigurationRevision,
  input: ClientConfigurationInput,
  acknowledgement: AcceptedAcknowledgement,
) {
  return executeConfigurationAction(client, {
    action: "update",
    configurationId,
    expectedRevision,
    input,
    acknowledgement,
  });
}

export function deleteConfiguration(
  client: ApiClient,
  configurationId: ConfigurationId,
  expectedRevision: ConfigurationRevision,
) {
  return executeConfigurationAction(client, {
    action: "delete",
    configurationId,
    expectedRevision,
  });
}

export function loadConfigurationInit(client: ApiClient): Promise<ConfigurationInitResponse> {
  return client.get<ConfigurationInitResponse>("/api/config/init", {
    schema: (body) => ConfigurationInitResponseSchema.parse(body),
  });
}

export function listConfigurations(client: ApiClient): Promise<ConfigurationListResponse> {
  return client.get<ConfigurationListResponse>("/api/config/providers", {
    schema: (body) => ConfigurationListResponseSchema.parse(body),
  });
}

export const bindConfig = (client: ApiClient) => ({
  executeConfigurationAction: (action: ClientConfigurationAction) =>
    executeConfigurationAction(client, action),
  createConfiguration: (input: ClientConfigurationInput) => createConfiguration(client, input),
  inspectConfiguration: (configurationId: ConfigurationId) =>
    inspectConfiguration(client, configurationId),
  selectConfiguration: (configurationId: ConfigurationId, modelId: ExactModelId) =>
    selectConfiguration(client, configurationId, modelId),
  testConfiguration: (configurationId: ConfigurationId) =>
    testConfiguration(client, configurationId),
  updateConfiguration: (
    configurationId: ConfigurationId,
    expectedRevision: ConfigurationRevision,
    input: ClientConfigurationInput,
    acknowledgement: AcceptedAcknowledgement,
  ) => updateConfiguration(client, configurationId, expectedRevision, input, acknowledgement),
  deleteConfiguration: (
    configurationId: ConfigurationId,
    expectedRevision: ConfigurationRevision,
  ) => deleteConfiguration(client, configurationId, expectedRevision),
  loadConfigurationInit: () => loadConfigurationInit(client),
  listConfigurations: () => listConfigurations(client),
});
