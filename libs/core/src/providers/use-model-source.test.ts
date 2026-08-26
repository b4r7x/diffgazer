/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import type { ConfigurationModelsResponse, ModelInfo } from "../schemas/config/models.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import { createDeferred } from "../testing/deferred.js";
import { createTestQueryWrapper } from "../testing/query-wrapper.js";
import { CATALOG_EMPTY_MODELS_REASON } from "./catalog-discovery-reasons.js";
import { useModelSource } from "./use-model-source.js";

const configurations = {
  hosted: {
    status: "supported",
    configurationId: "openrouter-primary",
    revision: 4,
    transportFamily: "hosted-api",
    productId: "openrouter",
    endpoint: "https://openrouter.ai/api/v1",
    selectedModelId: null,
    notices: [],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  gemini: {
    status: "supported",
    configurationId: "gemini-primary",
    revision: 2,
    transportFamily: "hosted-api",
    productId: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    selectedModelId: null,
    notices: [],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
} as const satisfies Record<string, ClientConfigurationSummary>;

const checkedAt = "2026-07-31T12:00:00.000Z";

function model(id: string): ModelInfo {
  return { id, name: id, description: "128K context", tier: "paid" };
}

function passedResponse(
  configuration: ClientConfigurationSummary,
  modelIds: readonly string[],
): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models: modelIds.map(model),
    checkedAt,
    source: "snapshot",
    cached: false,
  };
}

function skippedResponse(
  configuration: ClientConfigurationSummary,
  reason: string,
): ConfigurationModelsResponse {
  return {
    status: "skipped",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models: [],
    checkedAt,
    reason,
  };
}

describe("useModelSource", () => {
  let getConfigurationModels: Mock<BoundApi["getConfigurationModels"]>;

  beforeEach(() => {
    getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>(async () =>
      passedResponse(configurations.hosted, ["anthropic/claude-sonnet-4"]),
    );
  });

  it.each([
    { configuration: configurations.hosted, modelId: "anthropic/claude-sonnet-4" },
    { configuration: configurations.gemini, modelId: "gemini-2.5-flash" },
  ])("surfaces discovered models for $configuration.productId", async ({
    configuration,
    modelId,
  }) => {
    getConfigurationModels.mockResolvedValue(passedResponse(configuration, [modelId]));
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configuration), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current).toMatchObject({
      configurationId: configuration.configurationId,
      productId: configuration.productId,
      transportFamily: configuration.transportFamily,
      checkedAt,
      source: "snapshot",
      reason: null,
      error: null,
    });
    expect(result.current.models.map(({ id }) => id)).toEqual([modelId]);
    expect(getConfigurationModels).toHaveBeenCalledWith(
      configuration.configurationId,
      expect.any(AbortSignal),
    );
  });

  it("reports a skipped discovery without models", async () => {
    const reason = CATALOG_EMPTY_MODELS_REASON;
    getConfigurationModels.mockResolvedValue(skippedResponse(configurations.gemini, reason));
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.gemini), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("skipped"));

    expect(result.current).toMatchObject({ models: [], reason, error: null, checkedAt });
  });

  it("hides provider, token, and path details behind neutral error copy", async () => {
    getConfigurationModels.mockRejectedValue(
      new Error(
        "provider stderr: bearer token=secret-value at /Users/alice/.config/vendor/auth.json",
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.gemini), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toBe("Model discovery failed. Test the configuration again.");
    expect(result.current.error).not.toContain("secret-value");
    expect(result.current.error).not.toContain("/Users/alice");
    expect(result.current.models).toEqual([]);
  });

  it("bounds an untrusted skipped reason to neutral client copy", async () => {
    getConfigurationModels.mockResolvedValue(
      skippedResponse(
        configurations.gemini,
        "provider output /Users/alice/.config/auth token=untrusted-value",
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.gemini), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("skipped"));

    expect(result.current.reason).toBe(
      "Model discovery was skipped. Complete the required prerequisites, then test again.",
    );
    expect(result.current.reason).not.toContain("untrusted-value");
    expect(result.current.reason).not.toContain("/Users/alice");
    expect(result.current.models).toEqual([]);
  });

  it("fails closed on a response for another configuration tuple", async () => {
    getConfigurationModels.mockResolvedValue({
      status: "passed",
      configurationId: configurations.hosted.configurationId,
      productId: "gemini",
      transportFamily: "hosted-api",
      models: [model("anthropic/claude-sonnet-4")],
      checkedAt,
      source: "snapshot",
      cached: false,
    });
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.hosted), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current).toMatchObject({
      configurationId: "openrouter-primary",
      productId: "openrouter",
      transportFamily: "hosted-api",
      models: [],
      error: "Model discovery returned a different configuration tuple.",
    });
  });

  it("exposes an empty loading state while discovery is in flight", async () => {
    const pending = createDeferred<ConfigurationModelsResponse>();
    getConfigurationModels.mockReturnValue(pending.promise);
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.hosted), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("loading"));

    expect(result.current).toMatchObject({
      models: [],
      checkedAt: null,
      reason: null,
      error: null,
    });

    pending.resolve(passedResponse(configurations.hosted, ["anthropic/claude-sonnet-4"]));

    await waitFor(() => expect(result.current.status).toBe("passed"));
  });

  it("retries the same configuration discovery after an error", async () => {
    getConfigurationModels
      .mockRejectedValueOnce(new Error("Model discovery unavailable"))
      .mockResolvedValueOnce(passedResponse(configurations.gemini, ["qwen3-coder:30b"]));
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.gemini), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["qwen3-coder:30b"]);
    expect(getConfigurationModels.mock.calls.map(([configurationId]) => configurationId)).toEqual([
      "gemini-primary",
      "gemini-primary",
    ]);
  });

  it("keeps discovered models while the same configuration refetches under a new fingerprint", async () => {
    const pending = createDeferred<ConfigurationModelsResponse>();
    getConfigurationModels
      .mockResolvedValueOnce(passedResponse(configurations.hosted, ["anthropic/claude-sonnet-4"]))
      .mockReturnValueOnce(pending.promise);
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result, rerender } = renderHook(
      ({ configuration }: { configuration: ClientConfigurationSummary }) =>
        useModelSource(true, configuration),
      {
        wrapper: Wrapper,
        initialProps: { configuration: configurations.hosted as ClientConfigurationSummary },
      },
    );

    await waitFor(() => expect(result.current.status).toBe("passed"));

    // Saving a selection bumps revision and selectedModelId, rotating the
    // query key; the list must not blank to loading while the refetch runs.
    rerender({
      configuration: {
        ...configurations.hosted,
        revision: 5,
        selectedModelId: "anthropic/claude-sonnet-4",
      },
    });

    await waitFor(() => expect(getConfigurationModels).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe("passed");
    expect(result.current.models.map(({ id }) => id)).toEqual(["anthropic/claude-sonnet-4"]);
  });

  it("never carries one configuration's models into another configuration's load", async () => {
    getConfigurationModels
      .mockResolvedValueOnce(passedResponse(configurations.hosted, ["anthropic/claude-sonnet-4"]))
      .mockReturnValueOnce(createDeferred<ConfigurationModelsResponse>().promise);
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result, rerender } = renderHook(
      ({ configuration }: { configuration: ClientConfigurationSummary }) =>
        useModelSource(true, configuration),
      {
        wrapper: Wrapper,
        initialProps: { configuration: configurations.hosted as ClientConfigurationSummary },
      },
    );

    await waitFor(() => expect(result.current.status).toBe("passed"));

    rerender({ configuration: configurations.gemini });

    await waitFor(() => expect(result.current.status).toBe("loading"));
    expect(result.current.models).toEqual([]);
  });

  it("stays idle without fetching while the picker is closed", () => {
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(false, configurations.hosted), {
      wrapper: Wrapper,
    });

    expect(result.current).toMatchObject({
      status: "idle",
      configurationId: "openrouter-primary",
      productId: "openrouter",
      transportFamily: "hosted-api",
      models: [],
      checkedAt: null,
      reason: null,
      error: null,
    });

    result.current.retry();

    expect(getConfigurationModels).not.toHaveBeenCalled();
  });
});
