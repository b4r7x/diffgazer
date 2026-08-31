import type {
  ConfigurationInitResponse,
  ConfigurationListResponse,
} from "../schemas/config/configuration-status.js";
import {
  ConfigurationInitResponseSchema,
  ConfigurationListResponseSchema,
} from "../schemas/config/configuration-status.js";
import type { ConfigurationModelsResponse } from "../schemas/config/models.js";
import { ConfigurationModelsResponseSchema } from "../schemas/config/models.js";
import type {
  ClientConfigurationAction,
  ClientConfigurationActionResponse,
  ClientConfigurationInput,
  ConfigurationId,
  ConfigurationRevision,
  ExactModelId,
} from "../schemas/config/provider-config.js";
import { ClientConfigurationActionResponseSchema } from "../schemas/config/provider-config.js";
import type { ReadinessAcknowledgement } from "../schemas/config/readiness.js";
import type { HostedApiEndpoint } from "../schemas/config/transports.js";
import type { ApiClient } from "./types.js";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;
type ConfigurationActionName = ClientConfigurationAction["action"];
type ConfigurationActionResponse<Action extends ConfigurationActionName> = Extract<
  ClientConfigurationActionResponse,
  { action: Action }
>;

/**
 * Binds a parsed response back to the request that produced it. The response's
 * own semantics — which summary a succeeded action must carry, which notices and
 * readiness it may claim — belong to
 * {@link ClientConfigurationActionResponseSchema}; only the two facts the schema
 * cannot see, the echoed action and the addressed configuration, are checked
 * here.
 */
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
  if (
    configuration &&
    action.action !== "create" &&
    configuration.configurationId !== action.configurationId
  ) {
    throw new Error("Configuration action response belongs to a different configuration");
  }

  return response as ConfigurationActionResponse<Action["action"]>;
}

function executeConfigurationAction<Action extends ClientConfigurationAction>(
  client: ApiClient,
  action: Action,
): Promise<ConfigurationActionResponse<Action["action"]>> {
  return client.post<ConfigurationActionResponse<Action["action"]>>("/api/config/actions", action, {
    schema: (body) => parseBoundConfigurationActionResponse(action, body),
  });
}

export function createConfiguration(
  client: ApiClient,
  request: {
    input: ClientConfigurationInput;
    acknowledgement?: AcceptedAcknowledgement;
  },
) {
  const { input, acknowledgement } = request;
  return executeConfigurationAction(
    client,
    acknowledgement ? { action: "create", input, acknowledgement } : { action: "create", input },
  );
}

export function inspectConfiguration(client: ApiClient, configurationId: ConfigurationId) {
  return executeConfigurationAction(client, { action: "inspect", configurationId });
}

/**
 * `endpoint` is the billing pool the chosen model bills. Omitting it keeps the
 * pool the configuration is already bound to.
 */
export function selectConfiguration(
  client: ApiClient,
  configurationId: ConfigurationId,
  modelId: ExactModelId,
  endpoint?: HostedApiEndpoint,
) {
  return executeConfigurationAction(client, {
    action: "select",
    configurationId,
    modelId,
    ...(endpoint === undefined ? {} : { endpoint }),
  });
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

/**
 * `expectedRevision` is omitted only for a record this build could not decode:
 * it never showed the caller a revision to assert.
 */
export function deleteConfiguration(
  client: ApiClient,
  configurationId: ConfigurationId,
  expectedRevision?: ConfigurationRevision,
) {
  return executeConfigurationAction(client, {
    action: "delete",
    configurationId,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
  });
}

/**
 * Best-effort delete for tab-close cleanup. Uses a keepalive request so the
 * browser can finish revoking a wizard draft after `pagehide`.
 */
export function revokeConfigurationOnPageHide(
  client: ApiClient,
  configurationId: ConfigurationId,
  expectedRevision: ConfigurationRevision,
): void {
  void client
    .request("POST", "/api/config/actions", {
      body: {
        action: "delete",
        configurationId,
        expectedRevision,
      },
      keepalive: true,
    })
    .catch(() => undefined);
}

export function getConfigurationModels(
  client: ApiClient,
  configurationId: ConfigurationId,
  signal?: AbortSignal,
): Promise<ConfigurationModelsResponse> {
  return client.get<ConfigurationModelsResponse>(
    `/api/config/providers/${encodeURIComponent(configurationId)}/models`,
    {
      signal,
      schema: (body) => {
        const response = ConfigurationModelsResponseSchema.parse(body);
        if (response.configurationId !== configurationId) {
          throw new Error("Configuration models response belongs to a different configuration");
        }
        return response;
      },
    },
  );
}

export function loadConfigurationInit(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<ConfigurationInitResponse> {
  return client.get<ConfigurationInitResponse>("/api/config/init", {
    signal,
    schema: (body) => ConfigurationInitResponseSchema.parse(body),
  });
}

export function listConfigurations(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<ConfigurationListResponse> {
  return client.get<ConfigurationListResponse>("/api/config/providers", {
    signal,
    schema: (body) => ConfigurationListResponseSchema.parse(body),
  });
}

export const bindConfig = (client: ApiClient) => ({
  executeConfigurationAction: (action: ClientConfigurationAction) =>
    executeConfigurationAction(client, action),
  createConfiguration: (request: {
    input: ClientConfigurationInput;
    acknowledgement?: AcceptedAcknowledgement;
  }) => createConfiguration(client, request),
  inspectConfiguration: (configurationId: ConfigurationId) =>
    inspectConfiguration(client, configurationId),
  selectConfiguration: (
    configurationId: ConfigurationId,
    modelId: ExactModelId,
    endpoint?: HostedApiEndpoint,
  ) => selectConfiguration(client, configurationId, modelId, endpoint),
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
    expectedRevision?: ConfigurationRevision,
  ) => deleteConfiguration(client, configurationId, expectedRevision),
  revokeConfigurationOnPageHide: (
    configurationId: ConfigurationId,
    expectedRevision: ConfigurationRevision,
  ) => revokeConfigurationOnPageHide(client, configurationId, expectedRevision),
  getConfigurationModels: (configurationId: ConfigurationId, signal?: AbortSignal) =>
    getConfigurationModels(client, configurationId, signal),
  loadConfigurationInit: (signal?: AbortSignal) => loadConfigurationInit(client, signal),
  listConfigurations: (signal?: AbortSignal) => listConfigurations(client, signal),
});
