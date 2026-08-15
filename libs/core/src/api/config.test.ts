import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  READINESS_PRESENTATION,
  type ReadinessAcknowledgement,
} from "../schemas/config/readiness.js";
import { createApiClient } from "./client.js";
import {
  bindConfig,
  createConfiguration,
  deleteConfiguration,
  getConfigurationModels,
  inspectConfiguration,
  listConfigurations,
  loadConfigurationInit,
  revokeConfigurationOnPageHide,
  selectConfiguration,
  testConfiguration,
  updateConfiguration,
} from "./config.js";
import { createMockClient } from "./test-helpers.js";
import {
  type ApiClient,
  type BodyRequestOptions,
  isApiError,
  type QueryRequestOptions,
} from "./types.js";

const checkedAt = "2026-07-31T12:00:00.000Z";
const acknowledgement: Extract<ReadinessAcknowledgement, { status: "accepted" }> = {
  status: "accepted",
  noticeId: "groq-hosted-api",
  noticeVersion: 1,
  acceptedAt: checkedAt,
};
const groqNotice = {
  id: "groq-hosted-api",
  noticeVersion: 1,
  acknowledgement: "required",
  acknowledgeBefore: "first-context-send",
  renewAcknowledgementOn: "material-notice-change",
  billing: ["Current account and model limits are verified during setup."],
  privacy: ["Data handling follows the selected Groq API account and model terms."],
} as const;
const input = {
  transportFamily: "hosted-api",
  productId: "groq",
  endpoint: "https://api.groq.com/openai/v1",
} as const;
const configuration = {
  status: "supported",
  configurationId: "groq-primary",
  revision: 7,
  transportFamily: "hosted-api",
  productId: "groq",
  endpoint: "https://api.groq.com/openai/v1",
  selectedModelId: "openai/gpt-oss-120b",
  notices: [groqNotice],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} as const;
const readiness = {
  status: "ready",
  ready: true,
  evidenceStatus: "passed",
  checkedAt,
  acknowledgement,
  action: "inspect",
  explanation: "The exact configured review path is ready.",
  remediation: { code: "none", message: "No remediation is required." },
} as const;

function mockConfigurationActionPost(client: ApiClient, body: unknown): void {
  vi.mocked(client.post).mockImplementationOnce(
    async <T>(_path: string, _action: unknown, options?: BodyRequestOptions<T>) => {
      if (options?.schema) {
        return options.schema(body);
      }
      return body as T;
    },
  );
}

function mockConfigurationModelsGet(client: ApiClient, body: unknown): void {
  vi.mocked(client.get).mockImplementationOnce(
    async <T>(_path: string, options?: QueryRequestOptions<T>) => {
      if (options?.schema) {
        return options.schema(body);
      }
      return body as T;
    },
  );
}

const configurationModels = {
  status: "passed",
  configurationId: "groq-primary",
  productId: "groq",
  transportFamily: "hosted-api",
  models: [
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", description: "128K context", tier: "free" },
  ],
  checkedAt,
  source: "snapshot",
  cached: false,
} as const;

describe("config API functions", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("serializes all six configuration actions to the single frozen endpoint", async () => {
    for (const body of [
      { action: "create", status: "succeeded", configuration },
      { action: "inspect", status: "succeeded", configuration },
      { action: "select", status: "succeeded", configuration },
      {
        action: "test",
        status: "succeeded",
        configuration,
        readiness,
      },
      { action: "update", status: "succeeded", configuration },
      { action: "delete", status: "succeeded" },
    ]) {
      mockConfigurationActionPost(client, body);
    }

    const created = await createConfiguration(client, { input, acknowledgement });
    await inspectConfiguration(client, "groq-primary");
    await selectConfiguration(client, "groq-primary", "openai/gpt-oss-120b");
    await testConfiguration(client, "groq-primary");
    await updateConfiguration(client, "groq-primary", 7, input, acknowledgement);
    await deleteConfiguration(client, "groq-primary", 7);

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/api/config/actions",
      { action: "create", input, acknowledgement },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      "/api/config/actions",
      { action: "inspect", configurationId: "groq-primary" },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      "/api/config/actions",
      {
        action: "select",
        configurationId: "groq-primary",
        modelId: "openai/gpt-oss-120b",
      },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      4,
      "/api/config/actions",
      { action: "test", configurationId: "groq-primary" },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      5,
      "/api/config/actions",
      {
        action: "update",
        configurationId: "groq-primary",
        expectedRevision: 7,
        input,
        acknowledgement,
      },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      6,
      "/api/config/actions",
      { action: "delete", configurationId: "groq-primary", expectedRevision: 7 },
      { schema: expect.any(Function) },
    );
    expect(created.configuration).toMatchObject({
      configurationId: "groq-primary",
      revision: 7,
    });
  });

  it("rejects a response for a different action", async () => {
    mockConfigurationActionPost(client, { action: "delete", status: "succeeded" });

    await expect(inspectConfiguration(client, "groq-primary")).rejects.toThrow(
      "Configuration action response mismatch: expected inspect, received delete",
    );
  });

  it("rejects a successful response bound to a different configuration", async () => {
    mockConfigurationActionPost(client, {
      action: "inspect",
      status: "succeeded",
      configuration: { ...configuration, configurationId: "other-configuration" },
    });

    await expect(inspectConfiguration(client, "groq-primary")).rejects.toThrow(
      "Configuration action response belongs to a different configuration",
    );
  });

  it("rejects secret-bearing action responses at the HTTP boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        action: "create",
        status: "succeeded",
        credential: "must-not-cross-the-boundary",
      }),
    );
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    const apiClient = createApiClient({ baseUrl: "http://localhost:3000" });
    let error: unknown;
    try {
      await createConfiguration(apiClient, { input });
    } catch (caught) {
      error = caught;
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/config/actions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("Expected ApiError");
    expect(error).toMatchObject({ status: 422, code: "INVALID_RESPONSE" });
  });

  it("fetches configuration-bound catalog models from the encoded models path", async () => {
    mockConfigurationModelsGet(client, configurationModels);

    const response = await getConfigurationModels(client, "groq-primary");

    expect(client.get).toHaveBeenCalledWith("/api/config/providers/groq-primary/models", {
      schema: expect.any(Function),
    });
    expect(response).toEqual(configurationModels);
  });

  it("percent-encodes configuration IDs in the models path", async () => {
    mockConfigurationModelsGet(client, {
      ...configurationModels,
      configurationId: "cfg:primary",
    });

    await getConfigurationModels(client, "cfg:primary");

    expect(client.get).toHaveBeenCalledWith("/api/config/providers/cfg%3Aprimary/models", {
      schema: expect.any(Function),
    });
  });

  it("rejects a models response bound to a different configuration", async () => {
    mockConfigurationModelsGet(client, {
      ...configurationModels,
      configurationId: "other-configuration",
    });

    await expect(getConfigurationModels(client, "groq-primary")).rejects.toThrow(
      "Configuration models response belongs to a different configuration",
    );
  });

  it("rejects a malformed models response before it reaches consumers", async () => {
    mockConfigurationModelsGet(client, {
      ...configurationModels,
      cached: true,
    });

    await expect(getConfigurationModels(client, "groq-primary")).rejects.toThrow();
  });

  it("rejects cross-transport readiness at the list boundary as INVALID_RESPONSE", async () => {
    const malformedList = {
      schemaVersion: 2,
      configurations: [
        {
          configuration,
          readiness: {
            status: "local-conformance-failed",
            ready: false,
            evidenceStatus: "failed",
            checkedAt,
            acknowledgement: { status: "not-applicable" },
            ...READINESS_PRESENTATION["local-conformance-failed"],
          },
        },
      ],
      selectedConfigurationId: "groq-primary",
    };

    const fetchMock = vi.fn().mockResolvedValue(Response.json(malformedList));
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    const apiClient = createApiClient({ baseUrl: "http://localhost:3000" });
    let error: unknown;
    try {
      await listConfigurations(apiClient);
    } catch (caught) {
      error = caught;
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }

    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("Expected ApiError");
    expect(error).toMatchObject({ status: 422, code: "INVALID_RESPONSE" });
  });

  it("loads safe V2 configuration bootstrap and list projections", async () => {
    const list = {
      schemaVersion: 2,
      configurations: [{ configuration, readiness }],
      selectedConfigurationId: "groq-primary",
    } as const;
    const init = {
      ...list,
      settings: {
        theme: "auto",
        defaultLenses: ["correctness"],
        defaultProfile: null,
        severityThreshold: "info",
        secretsStorage: null,
        agentExecution: "sequential",
      },
      project: { path: "/repo", projectId: null, trust: null },
    } as const;
    vi.mocked(client.get).mockResolvedValueOnce(init).mockResolvedValueOnce(list);

    await expect(loadConfigurationInit(client)).resolves.toEqual(init);
    await expect(listConfigurations(client)).resolves.toEqual(list);
    expect(client.get).toHaveBeenNthCalledWith(1, "/api/config/init", {
      schema: expect.any(Function),
    });
    expect(client.get).toHaveBeenNthCalledWith(2, "/api/config/providers", {
      schema: expect.any(Function),
    });
  });

  it("revokes a wizard draft with a keepalive action request on page unload", () => {
    vi.mocked(client.request).mockResolvedValue(new Response());

    revokeConfigurationOnPageHide(client, "groq-primary", 7);

    expect(client.request).toHaveBeenCalledWith("POST", "/api/config/actions", {
      body: {
        action: "delete",
        configurationId: "groq-primary",
        expectedRevision: 7,
      },
      keepalive: true,
    });
  });

  it("binds only the V2 bootstrap and configuration action surface", () => {
    expect(Object.keys(bindConfig(client)).sort()).toEqual([
      "createConfiguration",
      "deleteConfiguration",
      "executeConfigurationAction",
      "getConfigurationModels",
      "inspectConfiguration",
      "listConfigurations",
      "loadConfigurationInit",
      "revokeConfigurationOnPageHide",
      "selectConfiguration",
      "testConfiguration",
      "updateConfiguration",
    ]);
  });
});
