/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import type {
  ClientConfigurationAction,
  ClientConfigurationActionResponse,
  ConfigurationInitResponse,
  ConfigurationListResponse,
} from "../../schemas/config/index.js";
import {
  ClientConfigurationActionResponseSchema,
  READINESS_PRESENTATION,
} from "../../schemas/config/index.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import { useConfigurationAction, useConfigurationInit, useConfigurations } from "./config.js";
import { configQueries } from "./queries/config.js";

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
  availableActions: ["inspect", "select", "test", "update", "delete"] as const,
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
});

describe("useConfigurationAction", () => {
  it.each(actions)("dispatches and invalidates V2 state for $action", async (action) => {
    const executeConfigurationAction = vi.fn(
      async (input: ClientConfigurationAction): Promise<ClientConfigurationActionResponse> =>
        ClientConfigurationActionResponseSchema.parse({
          action: input.action,
          status: "succeeded",
          ...(input.action !== "delete" ? { configuration: supportedConfiguration } : {}),
          ...(input.action === "test"
            ? {
                readiness: {
                  status: "ready",
                  ready: true,
                  evidenceStatus: "passed",
                  checkedAt: "2026-07-31T12:00:00.000Z",
                  acknowledgement,
                  ...READINESS_PRESENTATION.ready,
                },
              }
            : {}),
        }),
    );
    const harness = createTestQueryWrapper({ api: { executeConfigurationAction } });
    const initKey = configQueries.init(harness.api).queryKey;
    const configurationsKey = configQueries.configurations(harness.api).queryKey;
    harness.queryClient.setQueryData(initKey, configurationInit);
    harness.queryClient.setQueryData(configurationsKey, configurationList);

    const { result } = renderHook(() => useConfigurationAction(), { wrapper: harness.Wrapper });
    await act(async () => {
      await result.current.mutateAsync(action);
    });

    expect(executeConfigurationAction).toHaveBeenCalledWith(action);
    expect(harness.queryClient.getQueryState(initKey)?.isInvalidated).toBe(true);
    expect(harness.queryClient.getQueryState(configurationsKey)?.isInvalidated).toBe(true);
  });
});
