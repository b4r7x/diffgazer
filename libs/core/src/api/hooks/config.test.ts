/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  READINESS_PRESENTATION,
} from "../../schemas/config/index.js";
import { REMOVED_PRODUCT_ID } from "../../schemas/config/providers.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import {
  configurationFingerprint,
  useConfigurationAction,
  useConfigurationInit,
  useConfigurationInspect,
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

const removedConfiguration = {
  configurationId: "legacy-removed-zai-plan",
  revision: 3,
  status: "removed" as const,
  transportFamily: "hosted-api" as const,
  productId: REMOVED_PRODUCT_ID,
  selectedModelId: null,
  notices: [],
  availableActions: ["inspect", "delete"],
} satisfies Extract<ClientConfigurationSummary, { status: "removed" }>;

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
  selectedConfigurationId: null,
};

const configurationInit: ConfigurationInitResponse = {
  ...configurationList,
  settings: {
    theme: "auto",
    defaultLenses: ["correctness"],
    defaultProfile: null,
    severityThreshold: "low",
    secretsStorage: null,
    agentExecution: "parallel",
  },
  project: { path: "/repo", projectId: null, trust: null },
};

function makeWrapper(api: Partial<BoundApi>) {
  return createTestQueryWrapper({ api }).Wrapper;
}

function succeededActionResponse(
  action: ClientConfigurationAction,
): ClientConfigurationActionResponse {
  return ClientConfigurationActionResponseSchema.parse({
    action: action.action,
    status: "succeeded",
    ...(action.action !== "delete" ? { configuration: supportedConfiguration } : {}),
    ...(action.action === "test" ? { readiness } : {}),
  });
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

  it("isolates inspect caches by configurationId", async () => {
    const harness = createTestQueryWrapper({
      api: {
        inspectConfiguration: vi.fn(async (configurationId) =>
          succeededActionResponse({ action: "inspect", configurationId }),
        ),
      } as Partial<BoundApi>,
    });

    const inspectA = renderHook(() => useConfigurationInspect("gemini-primary"), {
      wrapper: harness.Wrapper,
    });
    const inspectB = renderHook(() => useConfigurationInspect("groq-primary"), {
      wrapper: harness.Wrapper,
    });

    await waitFor(() => expect(inspectA.result.current.data?.configuration).toBeDefined());
    await waitFor(() => expect(inspectB.result.current.data?.configuration).toBeDefined());

    expect(configQueries.inspect(harness.api, "gemini-primary").queryKey).not.toEqual(
      configQueries.inspect(harness.api, "groq-primary").queryKey,
    );
  });

  it("isolates catalog model caches by configurationId and fingerprint", async () => {
    const getConfigurationModels = vi.fn(async (configurationId: string) => ({
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
      api: { getConfigurationModels } as Partial<BoundApi>,
    });
    const revisedConfiguration = { ...supportedConfiguration, revision: 2 };

    const query = configurationModelsQuery(harness.api, supportedConfiguration);
    await expect(harness.queryClient.fetchQuery(query)).resolves.toMatchObject({
      status: "passed",
      configurationId: "gemini-primary",
    });

    expect(getConfigurationModels).toHaveBeenCalledWith("gemini-primary");
    expect(query.queryKey).not.toEqual(
      configurationModelsQuery(harness.api, alternateConfiguration).queryKey,
    );
    expect(query.queryKey).not.toEqual(
      configurationModelsQuery(harness.api, revisedConfiguration).queryKey,
    );
    expect(query.queryKey).not.toEqual(
      configQueries.inspect(harness.api, supportedConfiguration.configurationId).queryKey,
    );
    expect(configurationFingerprint(supportedConfiguration)).not.toEqual(
      configurationFingerprint(revisedConfiguration),
    );
  });
});

describe("V2 configuration mutations", () => {
  it("useCreateConfiguration dispatches create and invalidates summaries", async () => {
    const createConfiguration = vi.fn(async () =>
      succeededActionResponse({ action: "create", input: hostedInput }),
    );
    const harness = createTestQueryWrapper({ api: { createConfiguration } as Partial<BoundApi> });
    seedSummaries(harness);

    const { result } = renderHook(() => useCreateConfiguration(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync(hostedInput);
    });

    expect(createConfiguration).toHaveBeenCalledWith(hostedInput);
    expectSummariesInvalidated(harness);
  });

  it("useInspectConfiguration dispatches inspect and invalidates the bound inspect and model caches", async () => {
    const inspectConfiguration = vi.fn(async (configurationId: string) =>
      succeededActionResponse({ action: "inspect", configurationId }),
    );
    const harness = createTestQueryWrapper({ api: { inspectConfiguration } as Partial<BoundApi> });
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
    const selectConfiguration = vi.fn(async (configurationId: string, modelId: string) =>
      succeededActionResponse({ action: "select", configurationId, modelId }),
    );
    const harness = createTestQueryWrapper({ api: { selectConfiguration } as Partial<BoundApi> });
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
    const testConfiguration = vi.fn(async (configurationId: string) =>
      succeededActionResponse({ action: "test", configurationId }),
    );
    const harness = createTestQueryWrapper({ api: { testConfiguration } as Partial<BoundApi> });
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
    const updateConfiguration = vi.fn(async (configurationId: string, expectedRevision: number) =>
      succeededActionResponse({
        action: "update",
        configurationId,
        expectedRevision,
        input: hostedInput,
        acknowledgement,
      }),
    );
    const harness = createTestQueryWrapper({ api: { updateConfiguration } as Partial<BoundApi> });
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
    const deleteConfiguration = vi.fn(async (configurationId: string, expectedRevision: number) =>
      succeededActionResponse({ action: "delete", configurationId, expectedRevision }),
    );
    const harness = createTestQueryWrapper({ api: { deleteConfiguration } as Partial<BoundApi> });
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
    const executeConfigurationAction = vi.fn(
      async (input: ClientConfigurationAction): Promise<ClientConfigurationActionResponse> =>
        succeededActionResponse(input),
    );
    const harness = createTestQueryWrapper({
      api: { executeConfigurationAction } as Partial<BoundApi>,
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

describe("removed configuration state", () => {
  it("keeps removed inspect responses separate from supported ones", async () => {
    const harness = createTestQueryWrapper({
      api: {
        inspectConfiguration: vi.fn(async (configurationId: string) =>
          configurationId === removedConfiguration.configurationId
            ? ClientConfigurationActionResponseSchema.parse({
                action: "inspect",
                status: "succeeded",
                configuration: removedConfiguration,
              })
            : succeededActionResponse({ action: "inspect", configurationId }),
        ),
      } as Partial<BoundApi>,
    });

    const removed = renderHook(() => useConfigurationInspect("legacy-removed-zai-plan"), {
      wrapper: harness.Wrapper,
    });
    const supported = renderHook(() => useConfigurationInspect("gemini-primary"), {
      wrapper: harness.Wrapper,
    });

    await waitFor(() => expect(removed.result.current.data?.configuration?.status).toBe("removed"));
    await waitFor(() =>
      expect(supported.result.current.data?.configuration?.status).toBe("supported"),
    );

    expect(
      configQueries.inspect(harness.api, removedConfiguration.configurationId).queryKey,
    ).not.toEqual(
      configQueries.inspect(harness.api, supportedConfiguration.configurationId).queryKey,
    );
    expect(configurationFingerprint(removedConfiguration)).not.toEqual(
      configurationFingerprint(supportedConfiguration),
    );
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
    configQueries.inspect(harness.api, configuration.configurationId).queryKey,
    succeededActionResponse({
      action: "inspect",
      configurationId: configuration.configurationId,
    }),
  );
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
    harness.queryClient.getQueryState(
      configQueries.inspect(harness.api, configuration.configurationId).queryKey,
    )?.isInvalidated,
  ).toBe(true);
  expect(
    harness.queryClient.getQueryState(configurationModelsQuery(harness.api, configuration).queryKey)
      ?.isInvalidated,
  ).toBe(true);
}
