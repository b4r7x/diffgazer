/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import type { ConfigurationModelsResponse, ModelInfo } from "../schemas/config/models.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import { createDeferred } from "../testing/deferred.js";
import { createTestQueryWrapper } from "../testing/query-wrapper.js";
import {
  CATALOG_EMPTY_MODELS_REASON,
  CATALOG_SKIPPED_REASON,
} from "./catalog-discovery-reasons.js";
import { type SupportedConfigurationSummary, useModelSource } from "./use-model-source.js";

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
  localHttp: {
    status: "supported",
    configurationId: "ollama-loopback",
    revision: 2,
    transportFamily: "local-http",
    productId: "ollama",
    endpoint: "http://127.0.0.1:11434",
    authentication: "none",
    selectedModelId: null,
    notices: [],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  localCli: {
    status: "supported",
    configurationId: "codex-installation",
    revision: 1,
    transportFamily: "local-cli",
    productId: "codex-cli",
    installationId: "codex-default",
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
  configuration: SupportedConfigurationSummary,
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
  configuration: SupportedConfigurationSummary,
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
    { configuration: configurations.localHttp, modelId: "qwen3-coder:30b" },
    { configuration: configurations.localCli, modelId: "gpt-5-codex" },
  ])("surfaces discovered models for $configuration.transportFamily", async ({
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
      reason: null,
      error: null,
    });
    expect(result.current.models.map(({ id }) => id)).toEqual([modelId]);
    expect(getConfigurationModels).toHaveBeenCalledWith(configuration.configurationId);
  });

  it.each([
    CATALOG_SKIPPED_REASON,
    CATALOG_EMPTY_MODELS_REASON,
  ])("reports a skipped discovery without models for %j", async (reason) => {
    getConfigurationModels.mockResolvedValue(skippedResponse(configurations.localCli, reason));
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.localCli), {
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
    const { result } = renderHook(() => useModelSource(true, configurations.localHttp), {
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
        configurations.localHttp,
        "provider output /Users/alice/.config/auth token=untrusted-value",
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.localHttp), {
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
      productId: "groq",
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
      .mockResolvedValueOnce(passedResponse(configurations.localHttp, ["qwen3-coder:30b"]));
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useModelSource(true, configurations.localHttp), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["qwen3-coder:30b"]);
    expect(getConfigurationModels.mock.calls).toEqual([["ollama-loopback"], ["ollama-loopback"]]);
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
