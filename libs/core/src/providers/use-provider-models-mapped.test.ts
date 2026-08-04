/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import { configurationModelsQuery } from "../api/hooks/queries/config.js";
import type { ModelInfo } from "../schemas/config/models.js";
import type {
  ClientConfigurationSummary,
  ConfigurationId,
} from "../schemas/config/provider-config.js";
import type { RunnableProductId, TransportFamily } from "../schemas/config/transports.js";
import { createTestQueryWrapper } from "../testing/query-wrapper.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import { useProviderModelsMapped } from "./use-provider-models-mapped.js";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;

function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

const configurations = {
  groq: {
    status: "supported",
    configurationId: "groq-primary",
    revision: 1,
    transportFamily: "hosted-api",
    productId: "groq",
    endpoint: "https://api.groq.com/openai/v1",
    selectedModelId: null,
    notices: [copyNotice("groq")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  zai: {
    status: "supported",
    configurationId: "zai-primary",
    revision: 2,
    transportFamily: "hosted-api",
    productId: "zai",
    endpoint: "https://api.z.ai/api/paas/v4",
    selectedModelId: null,
    notices: [copyNotice("zai")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  qwen: {
    status: "supported",
    configurationId: "qwen-international",
    revision: 3,
    transportFamily: "hosted-api",
    productId: "qwen",
    endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    region: "international",
    workspace: "workspace-alpha",
    selectedModelId: null,
    notices: [copyNotice("qwen")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  openrouter: {
    status: "supported",
    configurationId: "openrouter-primary",
    revision: 1,
    transportFamily: "hosted-api",
    productId: "openrouter",
    endpoint: "https://openrouter.ai/api/v1",
    selectedModelId: null,
    notices: [copyNotice("openrouter")],
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
    notices: [copyNotice("ollama")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
} as const satisfies Record<string, ClientConfigurationSummary>;

const checkedAt = "2026-08-02T12:00:00.000Z";

function model(id: string, tier: ModelInfo["tier"] = "paid"): ModelInfo {
  return { id, name: id, description: "128K context", tier };
}

function passedResponse(
  configuration: SupportedConfigurationSummary,
  models: ModelInfo[],
  overrides: Partial<{
    configurationId: ConfigurationId;
    productId: RunnableProductId;
    transportFamily: TransportFamily;
  }> = {},
) {
  return {
    status: "passed" as const,
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models,
    checkedAt,
    source: "snapshot" as const,
    cached: false,
    ...overrides,
  };
}

function skippedResponse(configuration: SupportedConfigurationSummary, reason: string) {
  return {
    status: "skipped" as const,
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models: [],
    checkedAt,
    reason,
  };
}

describe("useProviderModelsMapped", () => {
  let getConfigurationModels: Mock<BoundApi["getConfigurationModels"]>;

  beforeEach(() => {
    getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>(async () =>
      passedResponse(configurations.groq, [model("openai/gpt-oss-120b", "free")]),
    );
  });

  it("lists catalog candidate models for a configuration without a selected model", async () => {
    getConfigurationModels.mockResolvedValue(
      passedResponse(configurations.groq, [
        model("openai/gpt-oss-120b", "free"),
        model("openai/gpt-oss-20b", "free"),
      ]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual([
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
    ]);
    expect(result.current.models[0]?.tier).toBe("free");
    expect(result.current).toMatchObject({
      configurationId: "groq-primary",
      productId: "groq",
      transportFamily: "hosted-api",
      checkedAt,
    });
    expect(getConfigurationModels).toHaveBeenCalledWith("groq-primary");
  });

  it("filters Z.AI opt-in-only Flash models out of the candidate list", async () => {
    getConfigurationModels.mockResolvedValue(
      passedResponse(configurations.zai, [
        model("glm-4.7"),
        model("glm-4.7-flash", "free"),
        model("glm-4.5"),
      ]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.zai), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["glm-4.7", "glm-4.5"]);
  });

  it("filters unpinned OpenRouter route selectors out of the candidate list", async () => {
    getConfigurationModels.mockResolvedValue(
      passedResponse(configurations.openrouter, [
        model("anthropic/claude-sonnet-4"),
        model("openrouter/auto"),
        model("openai/gpt-4.1-mini:free", "free"),
        model("gpt-4.1-mini"),
      ]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.openrouter), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["anthropic/claude-sonnet-4"]);
  });

  it.each([
    "qwen-max-latest",
    "../qwen3-coder-flash",
  ])("filters unsafe or alias model ID %s instead of failing the whole list", async (unsafeId) => {
    getConfigurationModels.mockResolvedValue(
      passedResponse(configurations.qwen, [model("qwen3-coder-flash"), model(unsafeId)]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.qwen), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["qwen3-coder-flash"]);
  });

  it("rejects inadmissible model ids at the query boundary, before any hook state mapping", async () => {
    getConfigurationModels.mockResolvedValue(
      passedResponse(configurations.qwen, [
        model("qwen3-coder-flash"),
        model("qwen-max-latest"),
        model("../qwen3-coder-flash"),
        model("qwen3-coder-plus"),
      ]),
    );
    const { api, queryClient } = createTestQueryWrapper({ api: { getConfigurationModels } });

    const response = await queryClient.fetchQuery(
      configurationModelsQuery(api, configurations.qwen),
    );

    expect(response.models.map(({ id }) => id)).toEqual(["qwen3-coder-flash"]);
  });

  it("keeps a passed-but-empty candidate list in the passed state", async () => {
    getConfigurationModels.mockResolvedValue(
      passedResponse(configurations.zai, [model("glm-4.7-flash", "free")]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.zai), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.reason).toBeNull();
  });

  it.each([
    "Catalog observations are unavailable for this configuration product.",
    "No catalog models are available for this configuration product.",
  ])("preserves the registry-owned skipped reason %j", async (reason) => {
    getConfigurationModels.mockResolvedValue(skippedResponse(configurations.localHttp, reason));
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.localHttp), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("skipped"));

    expect(result.current.models).toEqual([]);
    expect(result.current.reason).toBe(reason);
    expect(result.current.checkedAt).toBe(checkedAt);
  });

  it("bounds an untrusted skipped reason to neutral client copy", async () => {
    getConfigurationModels.mockResolvedValue(
      skippedResponse(
        configurations.localHttp,
        "provider output /Users/alice/.config/auth token=secret-value",
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.localHttp), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("skipped"));

    expect(result.current.reason).toBe(
      "Model discovery was skipped. Complete the required prerequisites, then test again.",
    );
    expect(result.current.reason).not.toContain("secret-value");
    expect(result.current.reason).not.toContain("/Users/alice");
  });

  it("does not expose provider, CLI, token, or path details from a query failure", async () => {
    getConfigurationModels.mockRejectedValue(
      new Error(
        "provider stderr: bearer token=secret-value at /Users/alice/.config/vendor/auth.json",
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toBe("Model discovery failed. Test the configuration again.");
    expect(result.current.error).not.toContain("secret-value");
    expect(result.current.error).not.toContain("/Users/alice");
    expect(new TextEncoder().encode(result.current.error ?? "").byteLength).toBeLessThanOrEqual(
      512,
    );
  });

  it("rejects a response for a different configuration tuple", async () => {
    getConfigurationModels.mockResolvedValue(
      passedResponse(configurations.zai, [model("glm-4.7")], { productId: "groq" }),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.zai), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe("Model discovery returned a different configuration tuple.");
  });

  it("filters Qwen higher-cost models that lack named live evidence", async () => {
    getConfigurationModels.mockResolvedValue(
      passedResponse(configurations.qwen, [model("qwen3-coder-flash"), model("qwen3-coder-plus")]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.qwen), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["qwen3-coder-flash"]);
  });

  it("does not reuse candidate lists across workspace-bound query cache entries", async () => {
    const secondCheckedAt = "2026-08-02T12:01:00.000Z";
    const secondConfiguration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      workspace: "workspace-beta",
    };
    getConfigurationModels
      .mockResolvedValueOnce(passedResponse(configurations.qwen, [model("qwen3-coder-flash")]))
      .mockResolvedValueOnce({
        ...passedResponse(secondConfiguration, [model("qwen3-coder-flash")]),
        checkedAt: secondCheckedAt,
      });
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const initialConfiguration: SupportedConfigurationSummary = configurations.qwen;
    const { result, rerender } = renderHook(
      ({ configuration }: { configuration: SupportedConfigurationSummary }) =>
        useProviderModelsMapped(true, configuration),
      { wrapper: Wrapper, initialProps: { configuration: initialConfiguration } },
    );

    await waitFor(() => expect(result.current.status).toBe("passed"));
    rerender({ configuration: secondConfiguration });

    await waitFor(() => expect(result.current.checkedAt).toBe(secondCheckedAt));
    expect(result.current.models.map(({ id }) => id)).toEqual(["qwen3-coder-flash"]);
    expect(getConfigurationModels.mock.calls).toEqual([
      ["qwen-international"],
      ["qwen-international"],
    ]);
  });

  it("retries the same configuration discovery after an error", async () => {
    getConfigurationModels
      .mockRejectedValueOnce(new Error("Model discovery unavailable"))
      .mockResolvedValueOnce(
        passedResponse(configurations.groq, [model("openai/gpt-oss-120b", "free")]),
      );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(getConfigurationModels.mock.calls).toEqual([["groq-primary"], ["groq-primary"]]);
  });

  it("stays idle without fetching while closed", () => {
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useProviderModelsMapped(false, configurations.groq), {
      wrapper: Wrapper,
    });

    expect(result.current).toMatchObject({ status: "idle", models: [], checkedAt: null });
    expect(getConfigurationModels).not.toHaveBeenCalled();
  });
});
