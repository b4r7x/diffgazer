import { beforeEach, describe, expect, it, vi } from "vitest";
import { REMOVED_PRODUCT_ID } from "../schemas/config/providers.js";
import type { ReadinessAcknowledgement } from "../schemas/config/readiness.js";
import { createApiClient } from "./client.js";
import {
  bindConfig,
  createConfiguration,
  deleteConfiguration,
  inspectConfiguration,
  listConfigurations,
  loadConfigurationInit,
  selectConfiguration,
  testConfiguration,
  updateConfiguration,
} from "./config.js";
import { createMockClient } from "./test-helpers.js";
import { type ApiClient, type BodyRequestOptions, isApiError } from "./types.js";

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

    const created = await createConfiguration(client, input);
    await inspectConfiguration(client, "groq-primary");
    await selectConfiguration(client, "groq-primary", "openai/gpt-oss-120b");
    await testConfiguration(client, "groq-primary");
    await updateConfiguration(client, "groq-primary", 7, input, acknowledgement);
    await deleteConfiguration(client, "groq-primary", 7);

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/api/config/actions",
      { action: "create", input },
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

  it("rejects a successful selection response for a different model", async () => {
    mockConfigurationActionPost(client, {
      action: "select",
      status: "succeeded",
      configuration: { ...configuration, selectedModelId: "openai/gpt-oss-20b" },
    });

    await expect(
      selectConfiguration(client, "groq-primary", "openai/gpt-oss-120b"),
    ).rejects.toThrow("Configuration action response selected a different model");
  });

  it("rejects a successful delete response that still contains a supported configuration", async () => {
    mockConfigurationActionPost(client, {
      action: "delete",
      status: "succeeded",
      configuration,
    });

    await expect(deleteConfiguration(client, "groq-primary", 7)).rejects.toThrow(
      "A successful delete response cannot contain a supported configuration",
    );
  });

  it("rejects a successful create response without a supported configuration", async () => {
    mockConfigurationActionPost(client, {
      action: "create",
      status: "succeeded",
      configuration: {
        configurationId: "groq-primary",
        revision: 1,
        status: "removed",
        transportFamily: "hosted-api",
        productId: REMOVED_PRODUCT_ID,
        selectedModelId: null,
        notices: [],
        availableActions: ["inspect", "delete"],
      },
    });

    await expect(createConfiguration(client, input)).rejects.toThrow(
      "A successful create response must contain a supported configuration",
    );
  });

  it("rejects stale update and delete response revisions", async () => {
    mockConfigurationActionPost(client, {
      action: "update",
      status: "succeeded",
      configuration: { ...configuration, revision: 6 },
    });
    mockConfigurationActionPost(client, {
      action: "delete",
      status: "succeeded",
      configuration: {
        configurationId: "groq-primary",
        revision: 6,
        status: "removed",
        transportFamily: "hosted-api",
        productId: REMOVED_PRODUCT_ID,
        selectedModelId: null,
        notices: [],
        availableActions: ["inspect", "delete"],
      },
    });

    await expect(
      updateConfiguration(client, "groq-primary", 7, input, acknowledgement),
    ).rejects.toThrow("Configuration action response returned a stale revision");
    await expect(deleteConfiguration(client, "groq-primary", 7)).rejects.toThrow(
      "Configuration delete response returned a stale revision",
    );
  });

  it("rejects successful actions that claim a removed configuration", async () => {
    mockConfigurationActionPost(client, {
      action: "test",
      status: "succeeded",
      configuration: {
        configurationId: "groq-primary",
        revision: 7,
        status: "removed",
        transportFamily: "hosted-api",
        productId: REMOVED_PRODUCT_ID,
        selectedModelId: null,
        notices: [],
        availableActions: ["inspect", "delete"],
      },
      readiness: {
        status: "removed",
        ready: false,
        evidenceStatus: "not-checked",
        checkedAt: null,
        acknowledgement: { status: "not-applicable" },
        action: "delete",
        explanation: "This saved product has been removed and cannot run reviews.",
        remediation: {
          code: "migrate-or-delete",
          message: "Create a supported replacement or explicitly delete this record.",
        },
      },
    });

    await expect(testConfiguration(client, "groq-primary")).rejects.toThrow(
      "A successful test response must contain a supported configuration",
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
      await createConfiguration(apiClient, input);
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

  it("binds only the V2 bootstrap and configuration action surface", () => {
    expect(Object.keys(bindConfig(client)).sort()).toEqual([
      "createConfiguration",
      "deleteConfiguration",
      "executeConfigurationAction",
      "inspectConfiguration",
      "listConfigurations",
      "loadConfigurationInit",
      "selectConfiguration",
      "testConfiguration",
      "updateConfiguration",
    ]);
  });
});
