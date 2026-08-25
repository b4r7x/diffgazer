/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { configurationFingerprint } from "../../providers/configuration-fingerprint.js";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import type {
  ClientConfigurationAction,
  ClientConfigurationActionResponse,
  ClientConfigurationSummary,
  ConfigurationInitResponse,
  ConfigurationListResponse,
} from "../../schemas/config/index.js";
import {
  ClientConfigurationActionResponseSchema,
  deriveDiagnosticsSetupGaps,
  READINESS_PRESENTATION,
  ReadinessSchema,
} from "../../schemas/config/index.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import {
  useConfigurationAction,
  useConfigurationInit,
  useConfigurations,
  useCreateConfiguration,
  useDeleteConfiguration,
  useInspectConfiguration,
  useSelectConfiguration,
  useTestConfiguration,
  useUpdateConfiguration,
} from "./config.js";
import { configQueries, configurationModelsQuery } from "./queries/config.js";

const notice = {
  ...PRODUCT_REGISTRY.gemini.notice,
  billing: [...PRODUCT_REGISTRY.gemini.notice.billing],
  privacy: [...PRODUCT_REGISTRY.gemini.notice.privacy],
};

const acknowledgement = {
  status: "accepted" as const,
  noticeId: notice.id,
  noticeVersion: notice.noticeVersion,
  acceptedAt: "2026-07-31T12:00:00.000Z",
};

const hostedInput = {
  transportFamily: "hosted-api" as const,
  productId: "gemini" as const,
  endpoint: "https://generativelanguage.googleapis.com/v1beta",
};

const supportedConfiguration = {
  configurationId: "gemini-primary",
  revision: 1,
  status: "supported" as const,
  transportFamily: "hosted-api" as const,
  productId: "gemini" as const,
  endpoint: hostedInput.endpoint,
  selectedModelId: "gemini-2.5-flash",
  notices: [notice],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} satisfies Extract<ClientConfigurationSummary, { status: "supported" }>;

const deepseekConfiguration = {
  ...supportedConfiguration,
  configurationId: "deepseek-payg",
  productId: "deepseek" as const,
  endpoint: "https://api.deepseek.com/v1",
  selectedModelId: "deepseek-v4-flash",
  notices: [
    {
      ...PRODUCT_REGISTRY.deepseek.notice,
      billing: [...PRODUCT_REGISTRY.deepseek.notice.billing],
      privacy: [...PRODUCT_REGISTRY.deepseek.notice.privacy],
    },
  ],
} satisfies Extract<ClientConfigurationSummary, { status: "supported" }>;

const alternateConfiguration = {
  ...supportedConfiguration,
  configurationId: "groq-primary",
  revision: 2,
  productId: "groq" as const,
  endpoint: "https://api.groq.com/openai/v1",
  selectedModelId: "openai/gpt-oss-120b",
  notices: [
    {
      ...PRODUCT_REGISTRY.groq.notice,
      billing: [...PRODUCT_REGISTRY.groq.notice.billing],
      privacy: [...PRODUCT_REGISTRY.groq.notice.privacy],
    },
  ],
} satisfies Extract<ClientConfigurationSummary, { status: "supported" }>;

const readiness = {
  status: "ready" as const,
  ready: true,
  evidenceStatus: "passed" as const,
  checkedAt: "2026-07-31T12:00:00.000Z",
  acknowledgement,
  ...READINESS_PRESENTATION.ready,
};

const actions = [
  { action: "create", input: hostedInput },
  { action: "inspect", configurationId: "gemini-primary" },
  { action: "select", configurationId: "gemini-primary", modelId: "gemini-2.5-flash" },
  { action: "test", configurationId: "gemini-primary" },
  {
    action: "update",
    configurationId: "gemini-primary",
    expectedRevision: 1,
    input: hostedInput,
    acknowledgement,
  },
  { action: "delete", configurationId: "gemini-primary", expectedRevision: 1 },
] as const satisfies readonly ClientConfigurationAction[];

const configurationList: ConfigurationListResponse = {
  schemaVersion: 2,
  configurations: [],
  unrecognizedConfigurations: [],
  selectedConfigurationId: null,
};

const configurationInit: ConfigurationInitResponse = {
  ...configurationList,
  settings: {
    theme: "auto",
    defaultLenses: ["correctness"],
    effectiveCallTokenCap: 49_152,
    defaultProfile: null,
    severityThreshold: "low",
    secretsStorage: null,
    agentExecution: "parallel",
    providerConsent: null,
  },
  project: { path: "/repo", projectId: null, trust: null },
};

function makeWrapper(api: Partial<BoundApi>) {
  return createTestQueryWrapper({ api }).Wrapper;
}

function succeededActionResponse<Action extends ClientConfigurationAction>(
  action: Action,
): Extract<ClientConfigurationActionResponse, { action: Action["action"] }> {
  return ClientConfigurationActionResponseSchema.parse({
    action: action.action,
    status: "succeeded",
    ...(action.action !== "delete" ? { configuration: supportedConfiguration } : {}),
    ...(action.action === "test" ? { readiness } : {}),
  }) as Extract<ClientConfigurationActionResponse, { action: Action["action"] }>;
}

function expectSummariesInvalidated(
  harness: ReturnType<typeof createTestQueryWrapper>,
  initInvalidated = true,
  configurationsInvalidated = true,
) {
  const initKey = configQueries.init(harness.api).queryKey;
  const configurationsKey = configQueries.configurations(harness.api).queryKey;
  if (initInvalidated) {
    expect(harness.queryClient.getQueryState(initKey)?.isInvalidated).toBe(true);
  }
  if (configurationsInvalidated) {
    expect(harness.queryClient.getQueryState(configurationsKey)?.isInvalidated).toBe(true);
  }
}

describe("configuration queries", () => {
  it("loads the V2 initialization payload", async () => {
    const loadConfigurationInit = vi.fn(async () => configurationInit);
    const { result } = renderHook(() => useConfigurationInit(), {
      wrapper: makeWrapper({ loadConfigurationInit }),
    });

    await waitFor(() => expect(result.current.data).toEqual(configurationInit));
    expect(loadConfigurationInit).toHaveBeenCalledOnce();
  });

  it("loads configuration summaries from their own cache key", async () => {
    const listConfigurations = vi.fn(async () => configurationList);
    const harness = createTestQueryWrapper({ api: { listConfigurations } });
    const { result } = renderHook(() => useConfigurations(), { wrapper: harness.Wrapper });

    await waitFor(() => expect(result.current.data).toEqual(configurationList));
    expect(listConfigurations).toHaveBeenCalledOnce();
    expect(configQueries.configurations(harness.api).queryKey).not.toEqual(
      configQueries.init(harness.api).queryKey,
    );
  });

  it("isolates catalog model caches by configurationId and fingerprint", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockImplementation(async (configurationId) => ({
        status: "passed" as const,
        configurationId,
        productId: supportedConfiguration.productId,
        transportFamily: supportedConfiguration.transportFamily,
        models: [],
        checkedAt: "2026-07-31T12:00:00.000Z",
        source: "snapshot" as const,
        cached: false,
      }));
    const harness = createTestQueryWrapper({
      api: { getConfigurationModels },
    });
    const revisedConfiguration = { ...supportedConfiguration, revision: 2 };

    const query = configurationModelsQuery(harness.api, supportedConfiguration);
    await expect(harness.queryClient.fetchQuery(query)).resolves.toMatchObject({
      status: "passed",
      configurationId: "gemini-primary",
    });

    expect(getConfigurationModels).toHaveBeenCalledWith("gemini-primary", expect.any(AbortSignal));
    expect(query.queryKey).not.toEqual(
      configurationModelsQuery(harness.api, alternateConfiguration).queryKey,
    );
    expect(query.queryKey).not.toEqual(
      configurationModelsQuery(harness.api, revisedConfiguration).queryKey,
    );
    expect(configurationFingerprint(supportedConfiguration)).not.toEqual(
      configurationFingerprint(revisedConfiguration),
    );
  });

  it("rejects inadmissible model ids at the query boundary", async () => {
    const model = (id: string) => ({
      id,
      name: id,
      description: "128K context",
      tier: "paid" as const,
    });
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue({
      status: "passed",
      configurationId: deepseekConfiguration.configurationId,
      productId: deepseekConfiguration.productId,
      transportFamily: deepseekConfiguration.transportFamily,
      models: [
        model("deepseek-v4-flash"),
        model("deepseek-latest"),
        model("../deepseek-v4-flash"),
        model("deepseek-v5-flash"),
      ],
      checkedAt: "2026-07-31T12:00:00.000Z",
      source: "snapshot",
      cached: false,
    });
    const harness = createTestQueryWrapper({ api: { getConfigurationModels } });

    const response = await harness.queryClient.fetchQuery(
      configurationModelsQuery(harness.api, deepseekConfiguration),
    );

    expect(response.models.map(({ id }) => id)).toEqual(["deepseek-v4-flash"]);
  });
});

describe("V2 configuration mutations", () => {
  it("useCreateConfiguration dispatches create and invalidates summaries", async () => {
    const createConfiguration = vi
      .fn<BoundApi["createConfiguration"]>()
      .mockImplementation(async () =>
        succeededActionResponse({ action: "create", input: hostedInput }),
      );
    const harness = createTestQueryWrapper({ api: { createConfiguration } });
    seedSummaries(harness);

    const { result } = renderHook(() => useCreateConfiguration(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ input: hostedInput, acknowledgement });
    });

    expect(createConfiguration).toHaveBeenCalledWith({ input: hostedInput, acknowledgement });
    expectSummariesInvalidated(harness);
  });

  it("useInspectConfiguration dispatches inspect and invalidates the bound inspect and model caches", async () => {
    const inspectConfiguration = vi
      .fn<BoundApi["inspectConfiguration"]>()
      .mockImplementation(async (configurationId) =>
        succeededActionResponse({ action: "inspect", configurationId }),
      );
    const harness = createTestQueryWrapper({ api: { inspectConfiguration } });
    seedSummaries(harness);
    seedPerConfigurationCaches(harness, supportedConfiguration);

    const { result } = renderHook(() => useInspectConfiguration(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync("gemini-primary");
    });

    expect(inspectConfiguration).toHaveBeenCalledWith("gemini-primary");
    expectSummariesInvalidated(harness);
    expectPerConfigurationInvalidated(harness, supportedConfiguration);
  });

  it("useSelectConfiguration dispatches select and invalidates the bound inspect and model caches", async () => {
    const selectConfiguration = vi
      .fn<BoundApi["selectConfiguration"]>()
      .mockImplementation(async (configurationId, modelId) =>
        succeededActionResponse({ action: "select", configurationId, modelId }),
      );
    const harness = createTestQueryWrapper({ api: { selectConfiguration } });
    seedSummaries(harness);
    seedPerConfigurationCaches(harness, supportedConfiguration);

    const { result } = renderHook(() => useSelectConfiguration(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        configurationId: "gemini-primary",
        modelId: "gemini-2.5-flash",
      });
    });

    expect(selectConfiguration).toHaveBeenCalledWith("gemini-primary", "gemini-2.5-flash");
    expectSummariesInvalidated(harness);
    expectPerConfigurationInvalidated(harness, supportedConfiguration);
  });

  it("useTestConfiguration dispatches test and invalidates the bound inspect and model caches", async () => {
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockImplementation(async (configurationId) =>
        succeededActionResponse({ action: "test", configurationId }),
      );
    const harness = createTestQueryWrapper({ api: { testConfiguration } });
    seedSummaries(harness);
    seedPerConfigurationCaches(harness, supportedConfiguration);

    const { result } = renderHook(() => useTestConfiguration(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync("gemini-primary");
    });

    expect(testConfiguration).toHaveBeenCalledWith("gemini-primary");
    expectSummariesInvalidated(harness);
    expectPerConfigurationInvalidated(harness, supportedConfiguration);
  });

  it("useUpdateConfiguration dispatches update and invalidates the bound inspect and model caches", async () => {
    const updateConfiguration = vi
      .fn<BoundApi["updateConfiguration"]>()
      .mockImplementation(async (configurationId, expectedRevision, input, acknowledgement) =>
        succeededActionResponse({
          action: "update",
          configurationId,
          expectedRevision,
          input,
          acknowledgement,
        }),
      );
    const harness = createTestQueryWrapper({ api: { updateConfiguration } });
    seedSummaries(harness);
    seedPerConfigurationCaches(harness, supportedConfiguration);

    const { result } = renderHook(() => useUpdateConfiguration(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        configurationId: "gemini-primary",
        expectedRevision: 1,
        input: hostedInput,
        acknowledgement,
      });
    });

    expect(updateConfiguration).toHaveBeenCalledWith(
      "gemini-primary",
      1,
      hostedInput,
      acknowledgement,
    );
    expectSummariesInvalidated(harness);
    expectPerConfigurationInvalidated(harness, supportedConfiguration);
  });

  it("useDeleteConfiguration dispatches delete and invalidates the bound inspect and model caches", async () => {
    const deleteConfiguration = vi
      .fn<BoundApi["deleteConfiguration"]>()
      .mockImplementation(async (configurationId, expectedRevision) =>
        succeededActionResponse({ action: "delete", configurationId, expectedRevision }),
      );
    const harness = createTestQueryWrapper({ api: { deleteConfiguration } });
    seedSummaries(harness);
    seedPerConfigurationCaches(harness, supportedConfiguration);

    const { result } = renderHook(() => useDeleteConfiguration(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        configurationId: "gemini-primary",
        expectedRevision: 1,
      });
    });

    expect(deleteConfiguration).toHaveBeenCalledWith("gemini-primary", 1);
    expectSummariesInvalidated(harness);
    expectPerConfigurationInvalidated(harness, supportedConfiguration);
  });
});

describe("useConfigurationAction", () => {
  it.each(actions)("dispatches and invalidates V2 state for $action", async (action) => {
    const executeConfigurationAction = vi
      .fn<BoundApi["executeConfigurationAction"]>()
      .mockImplementation(async (input) => succeededActionResponse(input));
    const harness = createTestQueryWrapper({
      api: { executeConfigurationAction },
    });
    seedSummaries(harness);
    if ("configurationId" in action) {
      seedPerConfigurationCaches(harness, supportedConfiguration);
    }

    const { result } = renderHook(() => useConfigurationAction(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync(action);
    });

    expect(executeConfigurationAction).toHaveBeenCalledWith(action);
    expectSummariesInvalidated(harness);
    if ("configurationId" in action) {
      expectPerConfigurationInvalidated(harness, supportedConfiguration);
    }
  });
});

describe("legacy provider mutation facade", () => {
  it("does not expose provider-keyed save/activate/delete hooks", async () => {
    const module = await import("./config.js");
    expect(module).not.toHaveProperty("useSaveConfig");
    expect(module).not.toHaveProperty("useActivateProvider");
    expect(module).not.toHaveProperty("useDeleteProviderCredentials");
    expect(module).not.toHaveProperty("useProviderStatus");
    expect(module).not.toHaveProperty("useOpenRouterModels");
    expect(module).not.toHaveProperty("useProviderModels");
  });
});

describe("deriveDiagnosticsSetupGaps", () => {
  const configuredInit: ConfigurationInitResponse = {
    ...configurationInit,
    configurations: [
      {
        configuration: supportedConfiguration,
        readiness: ReadinessSchema.parse(readiness),
      },
    ],
    selectedConfigurationId: supportedConfiguration.configurationId,
  };

  it("marks trust missing when read access was declined", () => {
    const setup = deriveDiagnosticsSetupGaps({
      ...configuredInit,
      project: {
        ...configuredInit.project,
        trust: {
          projectId: "proj-1",
          repoRoot: "/repo",
          trustedAt: "2026-07-31T12:00:00.000Z",
          capabilities: { readFiles: false, runCommands: false },
          trustMode: "persistent",
        },
      },
    });

    expect(setup.isConfigured).toBe(true);
    expect(setup.isReady).toBe(false);
    expect(setup.missing).toContain("trust");
  });

  it("marks trust missing when the saved repo root does not match the project path", () => {
    const setup = deriveDiagnosticsSetupGaps({
      ...configuredInit,
      project: {
        ...configuredInit.project,
        trust: {
          projectId: "proj-1",
          repoRoot: "/other",
          trustedAt: "2026-07-31T12:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
      },
    });

    expect(setup.isConfigured).toBe(true);
    expect(setup.isReady).toBe(false);
    expect(setup.missing).toContain("trust");
  });
});

function seedSummaries(harness: ReturnType<typeof createTestQueryWrapper>) {
  harness.queryClient.setQueryData(configQueries.init(harness.api).queryKey, configurationInit);
  harness.queryClient.setQueryData(
    configQueries.configurations(harness.api).queryKey,
    configurationList,
  );
}

function seedQueryData(
  queryClient: ReturnType<typeof createTestQueryWrapper>["queryClient"],
  key: readonly unknown[],
  data: unknown,
) {
  queryClient.setQueryData(key, data);
}

function seedPerConfigurationCaches(
  harness: ReturnType<typeof createTestQueryWrapper>,
  configuration: Extract<ClientConfigurationSummary, { status: "supported" }>,
) {
  seedQueryData(
    harness.queryClient,
    configurationModelsQuery(harness.api, configuration).queryKey,
    {
      status: "passed",
      configurationId: configuration.configurationId,
      productId: configuration.productId,
      transportFamily: configuration.transportFamily,
      models: [],
      checkedAt: "2026-07-31T12:00:00.000Z",
      source: "snapshot",
      cached: false,
    },
  );
}

function expectPerConfigurationInvalidated(
  harness: ReturnType<typeof createTestQueryWrapper>,
  configuration: Extract<ClientConfigurationSummary, { status: "supported" }>,
) {
  expect(
    harness.queryClient.getQueryState(configurationModelsQuery(harness.api, configuration).queryKey)
      ?.isInvalidated,
  ).toBe(true);
}
