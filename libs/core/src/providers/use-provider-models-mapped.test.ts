/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import type {
  ClientConfigurationActionResponse,
  ClientConfigurationSummary,
} from "../schemas/config/provider-config.js";
import type { Readiness } from "../schemas/config/readiness.js";
import type { RunnableProductId } from "../schemas/config/transports.js";
import { createDeferred } from "../testing/deferred.js";
import { createTestQueryWrapper } from "../testing/query-wrapper.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import { useProviderModelsMapped } from "./use-provider-models-mapped.js";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;
type TestConfigurationResponse = Extract<ClientConfigurationActionResponse, { action: "test" }>;

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
    selectedModelId: "openai/gpt-oss-120b",
    notices: [copyNotice("groq")],
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
    workspace: "workspace-reference",
    selectedModelId: "qwen3-coder-flash",
    notices: [copyNotice("qwen")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  zai: {
    status: "supported",
    configurationId: "zai-primary",
    revision: 2,
    transportFamily: "hosted-api",
    productId: "zai",
    endpoint: "https://api.z.ai/api/paas/v4",
    selectedModelId: "glm-4.7-flash",
    notices: [copyNotice("zai")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  moonshot: {
    status: "supported",
    configurationId: "moonshot-regional",
    revision: 3,
    transportFamily: "hosted-api",
    productId: "moonshot",
    endpoint: "https://api.moonshot.cn/v1",
    region: "mainland",
    selectedModelId: "kimi-k2.6",
    notices: [copyNotice("moonshot")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  openrouter: {
    status: "supported",
    configurationId: "openrouter-primary",
    revision: 1,
    transportFamily: "hosted-api",
    productId: "openrouter",
    endpoint: "https://openrouter.ai/api/v1",
    selectedModelId: "anthropic/claude-sonnet-4",
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
    selectedModelId: "qwen2.5-coder:7b",
    notices: [copyNotice("ollama")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
  localCli: {
    status: "supported",
    configurationId: "codex-installation",
    revision: 1,
    transportFamily: "local-cli",
    productId: "codex-cli",
    installationId: "codex-default",
    selectedModelId: "gpt-5-codex",
    notices: [copyNotice("codex-cli")],
    availableActions: ["inspect", "select", "test", "update", "delete"],
  },
} as const satisfies Record<string, ClientConfigurationSummary>;

const checkedAt = "2026-07-31T12:00:00.000Z";

function readyFor(productId: RunnableProductId): Extract<Readiness, { status: "ready" }> {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return {
    status: "ready",
    ready: true,
    evidenceStatus: "passed",
    checkedAt,
    acknowledgement: {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: checkedAt,
    },
    action: "inspect",
    explanation: "The exact configured review path is ready.",
    remediation: { code: "none", message: "No remediation is required." },
  };
}

const skipped: Readiness = {
  status: "skipped",
  ready: false,
  evidenceStatus: "skipped",
  checkedAt,
  acknowledgement: { status: "not-applicable" },
  action: "test",
  explanation: "The live readiness check was intentionally skipped.",
  remediation: {
    code: "enable-live-probe",
    message: "Satisfy the live-check prerequisites, then test the configuration again.",
  },
};

function acknowledgementRequiredFor(
  productId: RunnableProductId,
): Extract<Readiness, { status: "acknowledgement-required" }> {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return {
    status: "acknowledgement-required",
    ready: false,
    evidenceStatus: "passed",
    checkedAt,
    acknowledgement: {
      status: "required",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
    },
    action: "update",
    explanation: "The current product notice has not been accepted.",
    remediation: {
      code: "accept-notice",
      message: "Review and explicitly accept the current billing and privacy notice.",
    },
  };
}

function response(
  configuration: SupportedConfigurationSummary,
  readiness: Readiness = readyFor(configuration.productId),
  status: TestConfigurationResponse["status"] = "succeeded",
): TestConfigurationResponse {
  return { action: "test", status, configuration, readiness };
}

describe("useProviderModelsMapped", () => {
  let testConfiguration: Mock<BoundApi["testConfiguration"]>;

  beforeEach(() => {
    testConfiguration = vi.fn<BoundApi["testConfiguration"]>(async () =>
      response(configurations.groq),
    );
  });

  it("preserves the exact selected model after credentialed tuple evidence passes", async () => {
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["openai/gpt-oss-120b"]);
    expect(result.current.models[0]?.tier).toBe("paid");
    expect(result.current).toMatchObject({
      configurationId: "groq-primary",
      productId: "groq",
      transportFamily: "hosted-api",
      checkedAt,
    });
    expect(testConfiguration).toHaveBeenCalledWith("groq-primary");
  });

  it("exposes a discovered model before acknowledgement without claiming overall readiness", async () => {
    const provisionalConfiguration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      selectedModelId: null,
    };
    testConfiguration.mockResolvedValue(
      response(
        { ...provisionalConfiguration, selectedModelId: "qwen3-coder-flash" },
        acknowledgementRequiredFor("qwen"),
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, provisionalConfiguration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["qwen3-coder-flash"]);
    expect(result.current.models[0]?.description).toContain("credentialed");
    expect(result.current.checkedAt).toBe(checkedAt);
  });

  it.each([
    [
      "a different product",
      PRODUCT_REGISTRY.zai.notice.id,
      PRODUCT_REGISTRY.groq.notice.noticeVersion,
    ],
    [
      "an older version",
      PRODUCT_REGISTRY.groq.notice.id,
      PRODUCT_REGISTRY.groq.notice.noticeVersion - 1,
    ],
  ] as const)("rejects acknowledgement for %s before exposing a model", async (_, noticeId, noticeVersion) => {
    const invalidReadiness: Readiness = {
      ...readyFor("groq"),
      acknowledgement: { status: "accepted", noticeId, noticeVersion, acceptedAt: checkedAt },
    };
    testConfiguration.mockResolvedValue(response(configurations.groq, invalidReadiness));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe(
      "Model discovery acknowledgement did not match the current product notice.",
    );
  });

  it("rejects a wrong-product acknowledgement during provisional discovery", async () => {
    const provisionalConfiguration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      selectedModelId: null,
    };
    const invalidReadiness: Readiness = {
      ...acknowledgementRequiredFor("qwen"),
      acknowledgement: {
        status: "required",
        noticeId: PRODUCT_REGISTRY.zai.notice.id,
        noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
      },
    };
    testConfiguration.mockResolvedValue(
      response(
        { ...provisionalConfiguration, selectedModelId: "qwen3-coder-flash" },
        invalidReadiness,
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, provisionalConfiguration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.models).toEqual([]);
  });

  it("rejects a discovery response whose provisional tuple is changed", async () => {
    const provisionalConfiguration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      selectedModelId: null,
    };
    testConfiguration.mockResolvedValue(
      response(
        {
          ...provisionalConfiguration,
          endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          selectedModelId: "qwen3-coder-flash",
        },
        acknowledgementRequiredFor("qwen"),
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, provisionalConfiguration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe("Model discovery returned a different configuration tuple.");
  });

  it("rejects Qwen evidence from a different workspace", async () => {
    const configuration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      workspace: "workspace-alpha",
    };
    testConfiguration.mockResolvedValue(
      response({ ...configuration, workspace: "workspace-beta" }),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe("Model discovery returned a different configuration tuple.");
  });

  it("does not reuse Qwen model evidence across workspace-bound query cache entries", async () => {
    const firstConfiguration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      workspace: "workspace-alpha",
    };
    const secondConfiguration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      workspace: "workspace-beta",
    };
    const secondCheckedAt = "2026-07-31T12:01:00.000Z";
    const secondReadiness = readyFor("qwen");
    secondReadiness.checkedAt = secondCheckedAt;
    secondReadiness.acknowledgement.acceptedAt = secondCheckedAt;
    testConfiguration
      .mockResolvedValueOnce(response(firstConfiguration))
      .mockResolvedValueOnce(response(secondConfiguration, secondReadiness));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result, rerender } = renderHook(
      ({ configuration }: { configuration: SupportedConfigurationSummary }) =>
        useProviderModelsMapped(true, configuration),
      { wrapper: Wrapper, initialProps: { configuration: firstConfiguration } },
    );

    await waitFor(() => expect(result.current.status).toBe("passed"));
    rerender({ configuration: secondConfiguration });

    await waitFor(() => expect(result.current.checkedAt).toBe(secondCheckedAt));

    expect(result.current.status).toBe("passed");
    expect(result.current.models.map(({ id }) => id)).toEqual(["qwen3-coder-flash"]);
    expect(testConfiguration.mock.calls).toEqual([["qwen-international"], ["qwen-international"]]);
  });

  it.each([
    "qwen-max-latest",
    "../qwen3-coder-flash",
  ])("fails closed for unsafe or product-ineligible model ID %s", async (selectedModelId) => {
    const configuration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      selectedModelId,
    };
    testConfiguration.mockResolvedValue(response(configuration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe("Model discovery did not prove an eligible exact model ID.");
  });

  it("fails closed for Z.AI opt-in-only Flash models", async () => {
    testConfiguration.mockResolvedValue(response(configurations.zai));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.zai), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe("Model discovery did not prove an eligible exact model ID.");
  });

  it("does not expose Qwen higher-cost models without named live evidence", async () => {
    const configuration: SupportedConfigurationSummary = {
      ...configurations.qwen,
      selectedModelId: "qwen3-coder-plus",
    };
    testConfiguration.mockResolvedValue(response(configuration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe("Model discovery did not prove an eligible exact model ID.");
  });

  it.each([
    "gpt-4.1-mini",
    "openrouter/auto",
    "openrouter/automatic",
    "openai/gpt-4.1-mini:free",
    "openai/gpt-4.1-mini/online",
    "openai/gpt-4.1-mini/thinking",
  ] as const)("fails closed for an unpinned OpenRouter route: %s", async (selectedModelId) => {
    const configuration: SupportedConfigurationSummary = {
      ...configurations.openrouter,
      selectedModelId,
    };
    testConfiguration.mockResolvedValue(response(configuration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe("Model discovery did not prove an eligible exact model ID.");
  });

  it("preserves an exact OpenRouter downstream provider/model pair", async () => {
    const configuration: SupportedConfigurationSummary = {
      ...configurations.openrouter,
      selectedModelId: "anthropic/claude-3.7-sonnet",
    };
    testConfiguration.mockResolvedValue(response(configuration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["anthropic/claude-3.7-sonnet"]);
  });

  it("rejects a segmented latest alias from a discovered family", async () => {
    const configuration: SupportedConfigurationSummary = {
      ...configurations.moonshot,
      selectedModelId: "kimi-k3-latest",
    };
    testConfiguration.mockResolvedValue(response(configuration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.models).toEqual([]);
  });

  it("isolates exact action evidence when any configuration tuple field changes", async () => {
    const firstTuple = createDeferred<TestConfigurationResponse>();
    const changedConfiguration: SupportedConfigurationSummary = {
      ...configurations.moonshot,
      revision: 4,
      endpoint: "https://api.moonshot.ai/v1",
      region: "international",
      selectedModelId: "kimi-k3",
    };
    testConfiguration
      .mockImplementationOnce(() => firstTuple.promise)
      .mockResolvedValueOnce(response(changedConfiguration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const initialConfiguration: SupportedConfigurationSummary = configurations.moonshot;
    const { result, rerender } = renderHook(
      ({ configuration }: { configuration: SupportedConfigurationSummary }) =>
        useProviderModelsMapped(true, configuration),
      { wrapper: Wrapper, initialProps: { configuration: initialConfiguration } },
    );

    rerender({ configuration: changedConfiguration });
    await waitFor(() => expect(result.current.models.map(({ id }) => id)).toEqual(["kimi-k3"]));

    await act(async () => {
      firstTuple.resolve(response(configurations.moonshot));
      await firstTuple.promise;
    });

    expect(result.current.models.map(({ id }) => id)).toEqual(["kimi-k3"]);
    expect(testConfiguration.mock.calls).toEqual([["moonshot-regional"], ["moonshot-regional"]]);
  });

  it("tests local models by configuration identity without a fake key", async () => {
    testConfiguration.mockResolvedValue(response(configurations.localHttp));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.localHttp), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["qwen2.5-coder:7b"]);
    expect(result.current.models[0]?.tier).toBe("local");
    expect(result.current.models[0]?.description).toBe(
      "Exact loopback model-discovery evidence passed.",
    );
    expect(result.current.models[0]?.description).not.toContain("credential");
    expect(testConfiguration.mock.calls).toEqual([["ollama-loopback"]]);
  });

  it("describes local CLI model discovery without hosted credential language", async () => {
    testConfiguration.mockResolvedValue(response(configurations.localCli));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.localCli), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["gpt-5-codex"]);
    expect(result.current.models[0]?.tier).toBe("ambient");
    expect(result.current.models[0]?.description).toBe(
      "Exact local CLI model-discovery evidence passed.",
    );
    expect(result.current.models[0]?.description).not.toContain("credential");
    expect(testConfiguration.mock.calls).toEqual([["codex-installation"]]);
  });

  it("keeps skipped live evidence empty and distinct from passed", async () => {
    testConfiguration.mockResolvedValue(response(configurations.groq, skipped, "failed"));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("skipped"));

    expect(result.current.models).toEqual([]);
    expect(result.current.reason).toBe(
      "The live readiness check was intentionally skipped. Satisfy the live-check prerequisites, then test the configuration again.",
    );
  });

  it("does not expose provider, CLI, token, or path details from a query failure", async () => {
    testConfiguration.mockRejectedValue(
      new Error(
        "provider stderr: bearer token=secret-value at /Users/alice/.config/vendor/auth.json",
      ),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
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

  it("uses registry-owned readiness copy instead of untrusted response text", async () => {
    const untrustedReadiness = {
      ...skipped,
      status: "unreachable",
      evidenceStatus: "failed",
      explanation: "provider output /Users/alice/.config/auth token=secret-value",
      remediation: {
        code: "retry-connection",
        message: "cli stderr --token secret-value /private/auth.json",
      },
    } as unknown as Readiness;
    testConfiguration.mockResolvedValue(response(configurations.groq, untrustedReadiness));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toBe(
      "The configured service could not be reached. Check service availability, then test the configuration again.",
    );
    expect(result.current.error).not.toContain("secret-value");
    expect(result.current.error).not.toContain("/Users/alice");
  });

  it("bounds an untrusted skipped reason to neutral client copy", async () => {
    const untrustedReadiness = {
      ...skipped,
      explanation: "provider output /Users/alice/.config/auth token=secret-value",
      remediation: {
        ...skipped.remediation,
        message: "cli stderr --token secret-value /private/auth.json",
      },
    } as unknown as Readiness;
    testConfiguration.mockResolvedValue(
      response(configurations.groq, untrustedReadiness, "failed"),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("skipped"));

    expect(result.current.reason).toBe(
      "The live readiness check was intentionally skipped. Satisfy the live-check prerequisites, then test the configuration again.",
    );
    expect(result.current.reason).not.toContain("secret-value");
    expect(result.current.reason).not.toContain("/Users/alice");
  });

  it("rejects passed evidence from a different configuration tuple", async () => {
    testConfiguration.mockResolvedValue(
      response({ ...configurations.groq, revision: configurations.groq.revision + 1 }),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe("Model discovery returned a different configuration tuple.");
  });

  it("retries the same configuration action after an error", async () => {
    testConfiguration
      .mockRejectedValueOnce(new Error("Model discovery unavailable"))
      .mockResolvedValueOnce(response(configurations.groq));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(true, configurations.groq), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(testConfiguration.mock.calls).toEqual([["groq-primary"], ["groq-primary"]]);
  });

  it("stays idle without testing while closed", () => {
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useProviderModelsMapped(false, configurations.groq), {
      wrapper: Wrapper,
    });

    expect(result.current).toMatchObject({ status: "idle", models: [], checkedAt: null });
    expect(testConfiguration).not.toHaveBeenCalled();
  });
});
