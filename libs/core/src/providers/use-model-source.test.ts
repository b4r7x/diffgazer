/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";

const mockUseProviderModelsMapped = vi.fn();

vi.mock("./use-provider-models-mapped.js", () => ({
  useProviderModelsMapped: (...args: unknown[]) => mockUseProviderModelsMapped(...args),
}));

const { useModelSource } = await import("./use-model-source.js");

const retry = vi.fn();

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

function state(
  configuration: (typeof configurations)[keyof typeof configurations],
  overrides: Record<string, unknown> = {},
) {
  return {
    status: "passed",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models: [{ id: "exact/model-id", name: "Exact model", description: "", tier: "paid" }],
    checkedAt: "2026-07-31T12:00:00.000Z",
    reason: null,
    error: null,
    retry,
    ...overrides,
  };
}

describe("useModelSource", () => {
  beforeEach(() => {
    mockUseProviderModelsMapped.mockReset();
    retry.mockReset();
  });

  it.each([
    configurations.hosted,
    configurations.localHttp,
    configurations.localCli,
  ])("binds $transportFamily discovery to configuration $configurationId", (configuration) => {
    mockUseProviderModelsMapped.mockReturnValue(state(configuration));

    const { result } = renderHook(() => useModelSource(true, configuration));

    expect(mockUseProviderModelsMapped).toHaveBeenCalledWith(true, configuration);
    expect(result.current).toMatchObject({
      status: "passed",
      configurationId: configuration.configurationId,
      productId: configuration.productId,
      transportFamily: configuration.transportFamily,
    });
    expect(result.current.models.map(({ id }) => id)).toEqual(["exact/model-id"]);
  });

  it("uses the common configuration discovery path for OpenRouter", () => {
    mockUseProviderModelsMapped.mockReturnValue(state(configurations.hosted));

    renderHook(() => useModelSource(true, configurations.hosted));

    expect(mockUseProviderModelsMapped).toHaveBeenCalledOnce();
    expect(mockUseProviderModelsMapped).toHaveBeenCalledWith(true, configurations.hosted);
  });

  it("does not expose catalog observations when live discovery was skipped", () => {
    mockUseProviderModelsMapped.mockReturnValue(
      state(configurations.hosted, {
        status: "skipped",
        models: [{ id: "catalog-only", name: "Catalog only", description: "", tier: "free" }],
        reason: "Live discovery prerequisites were unavailable.",
      }),
    );

    const { result } = renderHook(() => useModelSource(true, configurations.hosted));

    expect(result.current.status).toBe("skipped");
    expect(result.current.models).toEqual([]);
    expect(result.current.reason).toBe("Live discovery prerequisites were unavailable.");
  });

  it("keeps skipped distinct from passed", () => {
    mockUseProviderModelsMapped.mockReturnValue(
      state(configurations.localCli, {
        status: "skipped",
        models: [],
        reason: "Compatibility evidence is unavailable for this installation.",
      }),
    );

    const { result } = renderHook(() => useModelSource(true, configurations.localCli));

    expect(result.current).toMatchObject({
      status: "skipped",
      models: [],
      error: null,
    });
    expect(result.current.status).not.toBe("passed");
  });

  it("does not expose models from a failed discovery", () => {
    mockUseProviderModelsMapped.mockReturnValue(
      state(configurations.localHttp, {
        status: "error",
        models: [{ id: "partial-model", name: "Partial", description: "", tier: "paid" }],
        reason: null,
        error: "The configured local endpoint is unreachable.",
      }),
    );

    const { result } = renderHook(() => useModelSource(true, configurations.localHttp));

    expect(result.current).toMatchObject({
      status: "error",
      models: [],
      error: "The configured local endpoint is unreachable.",
    });
  });

  it("hides untrusted query and provider details behind a safe error", () => {
    mockUseProviderModelsMapped.mockReturnValue(
      state(configurations.localHttp, {
        status: "error",
        error: "Bearer credential at /Users/alice/.config/provider/auth.json",
      }),
    );

    const { result } = renderHook(() => useModelSource(true, configurations.localHttp));

    expect(result.current.error).toBe("Model discovery failed. Test the configuration again.");
    expect(result.current.error).not.toContain("/Users/alice");
  });

  it("preserves only allowlisted safe discovery diagnostics", () => {
    mockUseProviderModelsMapped.mockReturnValue(
      state(configurations.localHttp, {
        status: "error",
        error: "Model discovery returned a different configuration tuple.",
      }),
    );

    const { result } = renderHook(() => useModelSource(true, configurations.localHttp));

    expect(result.current.error).toBe("Model discovery returned a different configuration tuple.");
  });

  it("bounds skipped reasons to safe readiness copy", () => {
    mockUseProviderModelsMapped.mockReturnValue(
      state(configurations.hosted, {
        status: "skipped",
        models: [{ id: "catalog-only", name: "Catalog only", description: "", tier: "free" }],
        reason: "provider output /Users/alice/.config/auth token=untrusted-value",
      }),
    );

    const { result } = renderHook(() => useModelSource(true, configurations.hosted));

    expect(result.current.status).toBe("skipped");
    expect(result.current.models).toEqual([]);
    expect(result.current.reason).toBe(
      "Model discovery was skipped. Complete the required prerequisites, then test again.",
    );
  });

  it("fails closed when discovery returns another configuration identity", () => {
    mockUseProviderModelsMapped.mockReturnValue(
      state(configurations.localHttp, {
        configurationId: "ollama-other",
      }),
    );

    const { result } = renderHook(() => useModelSource(true, configurations.localHttp));

    expect(result.current).toMatchObject({
      status: "error",
      configurationId: "ollama-loopback",
      productId: "ollama",
      transportFamily: "local-http",
      models: [],
      error: "Model discovery returned a different configuration identity.",
    });
  });

  it("returns an idle empty state while the picker is closed", () => {
    mockUseProviderModelsMapped.mockReturnValue(state(configurations.hosted));

    const { result } = renderHook(() => useModelSource(false, configurations.hosted));

    expect(result.current).toMatchObject({
      status: "idle",
      configurationId: "openrouter-primary",
      models: [],
      checkedAt: null,
      reason: null,
      error: null,
    });
  });
});
