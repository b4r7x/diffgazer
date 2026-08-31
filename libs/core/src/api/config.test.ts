import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getEndpointPoolContext, getModelBillingPool } from "../providers/endpoint-pools.js";
import { ConfigurationModelsResponseSchema } from "../schemas/config/models.js";
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
  noticeId: "zai-general-payg",
  noticeVersion: 1,
  acceptedAt: checkedAt,
};
const zaiNotice = {
  id: "zai-general-payg",
  noticeVersion: 1,
  acknowledgement: "required",
  acknowledgeBefore: "first-context-send",
  renewAcknowledgementOn: "material-notice-change",
  billing: ["This configuration uses general Open Platform pay-as-you-go billing."],
  privacy: ["API no-training and data-handling claims apply only to the exact general PAYG route."],
} as const;
const input = {
  transportFamily: "hosted-api",
  productId: "zai",
  endpoint: "https://api.z.ai/api/paas/v4",
} as const;
const configuration = {
  status: "supported",
  configurationId: "zai-primary",
  revision: 7,
  transportFamily: "hosted-api",
  productId: "zai",
  endpoint: "https://api.z.ai/api/paas/v4",
  selectedModelId: "glm-4.7",
  notices: [zaiNotice],
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
  configurationId: "zai-primary",
  productId: "zai",
  transportFamily: "hosted-api",
  models: [{ id: "glm-4.7", name: "GLM-4.7", description: "128K context", tier: "free" }],
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
    await inspectConfiguration(client, "zai-primary");
    await selectConfiguration(client, "zai-primary", "glm-4.7");
    await testConfiguration(client, "zai-primary");
    await updateConfiguration(client, "zai-primary", 7, input, acknowledgement);
    await deleteConfiguration(client, "zai-primary", 7);

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      "/api/config/actions",
      { action: "create", input, acknowledgement },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      "/api/config/actions",
      { action: "inspect", configurationId: "zai-primary" },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      "/api/config/actions",
      {
        action: "select",
        configurationId: "zai-primary",
        modelId: "glm-4.7",
      },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      4,
      "/api/config/actions",
      { action: "test", configurationId: "zai-primary" },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      5,
      "/api/config/actions",
      {
        action: "update",
        configurationId: "zai-primary",
        expectedRevision: 7,
        input,
        acknowledgement,
      },
      { schema: expect.any(Function) },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      6,
      "/api/config/actions",
      { action: "delete", configurationId: "zai-primary", expectedRevision: 7 },
      { schema: expect.any(Function) },
    );
    expect(created.configuration).toMatchObject({
      configurationId: "zai-primary",
      revision: 7,
    });
  });

  it("posts the billing pool alongside the model when select carries an endpoint", async () => {
    mockConfigurationActionPost(client, { action: "select", status: "succeeded", configuration });

    await selectConfiguration(client, "zai-primary", "glm-4.7", "https://opencode.ai/zen/go/v1");

    expect(client.post).toHaveBeenCalledWith(
      "/api/config/actions",
      {
        action: "select",
        configurationId: "zai-primary",
        modelId: "glm-4.7",
        endpoint: "https://opencode.ai/zen/go/v1",
      },
      { schema: expect.any(Function) },
    );
  });

  it("rejects a response for a different action", async () => {
    mockConfigurationActionPost(client, { action: "delete", status: "succeeded" });

    await expect(inspectConfiguration(client, "zai-primary")).rejects.toThrow(
      "Configuration action response mismatch: expected inspect, received delete",
    );
  });

  it("rejects a successful response bound to a different configuration", async () => {
    mockConfigurationActionPost(client, {
      action: "inspect",
      status: "succeeded",
      configuration: { ...configuration, configurationId: "other-configuration" },
    });

    await expect(inspectConfiguration(client, "zai-primary")).rejects.toThrow(
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

    const response = await getConfigurationModels(client, "zai-primary");

    expect(client.get).toHaveBeenCalledWith("/api/config/providers/zai-primary/models", {
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

    await expect(getConfigurationModels(client, "zai-primary")).rejects.toThrow(
      "Configuration models response belongs to a different configuration",
    );
  });

  it("rejects a malformed models response before it reaches consumers", async () => {
    mockConfigurationModelsGet(client, {
      ...configurationModels,
      cached: true,
    });

    await expect(getConfigurationModels(client, "zai-primary")).rejects.toThrow();
  });

  it("rejects inconsistent readiness at the list boundary as INVALID_RESPONSE", async () => {
    const malformedList = {
      schemaVersion: 2,
      configurations: [
        {
          configuration,
          readiness: {
            status: "unconfigured",
            ready: false,
            evidenceStatus: "not-checked",
            checkedAt: null,
            acknowledgement: { status: "not-applicable" },
            ...READINESS_PRESENTATION.unconfigured,
          },
        },
      ],
      selectedConfigurationId: "zai-primary",
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
      selectedConfigurationId: "zai-primary",
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
        providerConsent: null,
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

    revokeConfigurationOnPageHide(client, "zai-primary", 7);

    expect(client.request).toHaveBeenCalledWith("POST", "/api/config/actions", {
      body: {
        action: "delete",
        configurationId: "zai-primary",
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

/**
 * Pinned copies of the pre-pool row and envelope shapes, declared here from
 * HEAD's source so a client built before endpoint-profile membership existed can
 * be replayed against a new server's payload.
 */
const PinnedPrePoolModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tier: z.enum(["free", "paid", "unknown"]),
  recommended: z.boolean().optional(),
  releaseDate: z.string().optional(),
});

const PinnedPrePoolPassedModelsSchema = z.strictObject({
  status: z.literal("passed"),
  configurationId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
  productId: z.enum([
    "gemini",
    "zai",
    "openrouter",
    "deepseek",
    "qwen",
    "moonshot",
    "minimax",
    "ollama-cloud",
    "opencode-zen",
  ]),
  transportFamily: z.literal("hosted-api"),
  checkedAt: z.iso.datetime(),
  models: z.array(PinnedPrePoolModelInfoSchema),
  source: z.literal("provider-live"),
  cached: z.literal(false),
});

const newServerModelsResponse = {
  status: "passed",
  configurationId: "opencode-primary",
  productId: "opencode-zen",
  transportFamily: "hosted-api",
  models: [
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      description: "128K context",
      tier: "paid",
      endpointProfileIds: ["zen", "go"],
    },
  ],
  checkedAt,
  source: "provider-live",
  cached: false,
} as const;

/** The live `passed` envelope variant for one `source`, so its key set can be compared to the pinned copy. */
function liveModelsEnvelopeKeys(source: string): string[] {
  const option = ConfigurationModelsResponseSchema.options[0].options.find(
    (candidate) => candidate.shape.source.value === source,
  );
  if (!option) throw new Error(`No configuration models envelope for source ${source}`);
  return Object.keys(option.shape).sort();
}

describe("configuration models wire compatibility", () => {
  it("lets a pre-pool client parse a pool-labeled models response, dropping the unknown field", () => {
    // The fixture has to be a payload today's server can actually emit, and the
    // pinned envelope has to still name every key that envelope carries: an
    // optional key added upstream is invisible to a fixture-only parse yet
    // rejected by the strictObject a pre-pool client ships.
    expect(() => ConfigurationModelsResponseSchema.parse(newServerModelsResponse)).not.toThrow();
    expect(liveModelsEnvelopeKeys("provider-live")).toEqual(
      Object.keys(PinnedPrePoolPassedModelsSchema.shape).sort(),
    );

    const parsed = PinnedPrePoolPassedModelsSchema.parse(newServerModelsResponse);

    expect(parsed.models).toEqual([
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        description: "128K context",
        tier: "paid",
      },
    ]);
  });

  it("parses a pre-pool models response and bills its rows to the bound pool", async () => {
    const client = createMockClient();
    const oldServerModels = newServerModelsResponse.models.map(
      ({ endpointProfileIds: _membership, ...row }) => row,
    );
    mockConfigurationModelsGet(client, { ...newServerModelsResponse, models: oldServerModels });

    const response = await getConfigurationModels(client, "opencode-primary");

    expect(response.models).toEqual(oldServerModels);
    const poolContext = getEndpointPoolContext("opencode-zen", "https://opencode.ai/zen/v1");
    if (!poolContext) throw new Error("Expected an opencode-zen pool context");
    expect(response.models.map((model) => getModelBillingPool(poolContext, model)?.id)).toEqual([
      "zen",
    ]);
  });
});
