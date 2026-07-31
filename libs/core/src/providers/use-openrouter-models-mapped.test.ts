/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, type Mock, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import type {
  ClientConfigurationActionResponse,
  ClientConfigurationSummary,
} from "../schemas/config/provider-config.js";
import type { Readiness } from "../schemas/config/readiness.js";
import { createTestQueryWrapper } from "../testing/query-wrapper.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import {
  getCompatibilityLabel,
  type OpenRouterConfigurationSummary,
  useOpenRouterModelsMapped,
} from "./use-openrouter-models-mapped.js";

type TestConfigurationResponse = Extract<ClientConfigurationActionResponse, { action: "test" }>;

const checkedAt = "2026-07-31T12:00:00.000Z";
const openRouterNotice = PRODUCT_REGISTRY.openrouter.notice;
function copyOpenRouterNotice() {
  return {
    ...openRouterNotice,
    billing: [...openRouterNotice.billing],
    privacy: [...openRouterNotice.privacy],
  };
}

const configuration = {
  status: "supported",
  configurationId: "openrouter-primary",
  revision: 4,
  transportFamily: "hosted-api",
  productId: "openrouter",
  endpoint: "https://openrouter.ai/api/v1",
  selectedModelId: "anthropic/claude-sonnet-4",
  notices: [copyOpenRouterNotice()],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} as const satisfies ClientConfigurationSummary;

const ready: Readiness = {
  status: "ready",
  ready: true,
  evidenceStatus: "passed",
  checkedAt,
  acknowledgement: {
    status: "accepted",
    noticeId: openRouterNotice.id,
    noticeVersion: openRouterNotice.noticeVersion,
    acceptedAt: checkedAt,
  },
  action: "inspect",
  explanation: "The exact configured review path is ready.",
  remediation: { code: "none", message: "No remediation is required." },
};

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

function response(
  testedConfiguration: OpenRouterConfigurationSummary = configuration,
  readiness: Readiness = ready,
  status: TestConfigurationResponse["status"] = "succeeded",
): TestConfigurationResponse {
  return { action: "test", status, configuration: testedConfiguration, readiness };
}

describe("useOpenRouterModelsMapped", () => {
  it("exposes an exact pinned route only after its configuration action passes", async () => {
    const testConfiguration: Mock<BoundApi["testConfiguration"]> = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(response());
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current).toMatchObject({
      configurationId: "openrouter-primary",
      productId: "openrouter",
      transportFamily: "hosted-api",
      total: 1,
      pinned: 1,
      checkedAt,
    });
    expect(result.current.models.map(({ id }) => id)).toEqual(["anthropic/claude-sonnet-4"]);
    expect(testConfiguration).toHaveBeenCalledWith("openrouter-primary");
    expect(getCompatibilityLabel(result.current)).toBe("Showing 1 exact pinned downstream route.");
  });

  it.each([
    "auto/model",
    "automatic/model",
    "cheapest/model",
    "default/model",
    "exacto/model",
    "extended/model",
    "free/model",
    "fallback/model",
    "fastest/model",
    "floor/model",
    "nitro/model",
    "online/model",
    "random/model",
    "route/model",
    "thinking/model",
    "provider/auto",
    "provider/automatic",
    "provider/cheapest",
    "provider/default",
    "provider/exacto",
    "provider/extended",
    "provider/free",
    "provider/fallback",
    "provider/fastest",
    "provider/floor",
    "provider/nitro",
    "provider/online",
    "provider/openrouter",
    "provider/random",
    "provider/route",
    "provider/thinking",
    "AUTO/model",
    "provider/Fallback",
    "openrouter/gpt-4.1",
    "OpenRouter/gpt-4.1",
    "provider/OpenRouter",
    "meta-llama/llama-3.3-70b:free",
  ] as const)("fails closed instead of enabling OpenRouter route %s", async (selectedModelId) => {
    const testedConfiguration = { ...configuration, selectedModelId };
    const testConfiguration: Mock<BoundApi["testConfiguration"]> = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(response(testedConfiguration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, testedConfiguration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    // The shared configuration-bound discovery hook rejects forged selectors
    // before the OpenRouter adapter sees them, so there is no passed source
    // catalogue to count.
    expect(result.current).toMatchObject({ total: 0, pinned: 0 });
    expect(result.current.error).toBe("Model discovery did not prove an eligible exact model ID.");
  });

  it.each([
    "freeform/model",
    "provider/fallback-v2",
    "automaticity/model",
  ] as const)("preserves exact downstream route segments that only contain a reserved selector: %s", async (selectedModelId) => {
    const testedConfiguration = { ...configuration, selectedModelId };
    const testConfiguration: Mock<BoundApi["testConfiguration"]> = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(response(testedConfiguration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, testedConfiguration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual([selectedModelId]);
    expect(result.current).toMatchObject({ total: 1, pinned: 1 });
  });

  it("rejects latest aliases before exposing an OpenRouter route", async () => {
    const testedConfiguration = { ...configuration, selectedModelId: "anthropic/claude-latest" };
    const testConfiguration: Mock<BoundApi["testConfiguration"]> = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(response(testedConfiguration));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, testedConfiguration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.models).toEqual([]);
    expect(result.current).toMatchObject({ total: 0, pinned: 0 });
  });

  it("keeps skipped live evidence empty without substituting catalog routes", async () => {
    const testConfiguration: Mock<BoundApi["testConfiguration"]> = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(response(configuration, skipped, "failed"));
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("skipped"));

    expect(result.current.models).toEqual([]);
    expect(result.current).toMatchObject({ total: 0, pinned: 0 });
    expect(result.current.reason).toBe(
      "The live readiness check was intentionally skipped. Satisfy the live-check prerequisites, then test the configuration again.",
    );
  });

  it("stays idle without testing while closed", () => {
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>();
    const { Wrapper } = createTestQueryWrapper({ api: { testConfiguration } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(false, configuration), {
      wrapper: Wrapper,
    });

    expect(result.current).toMatchObject({
      status: "idle",
      models: [],
      total: 0,
      pinned: 0,
    });
    expect(testConfiguration).not.toHaveBeenCalled();
  });
});

describe("getCompatibilityLabel", () => {
  it.each([
    [{ total: 0, pinned: 0 }, "No exact pinned downstream routes available."],
    [{ total: 1, pinned: 1 }, "Showing 1 exact pinned downstream route."],
    [{ total: 3, pinned: 3 }, "Showing 3 exact pinned downstream routes."],
  ] as const)("describes pinned route counts for %j", (state, label) => {
    expect(getCompatibilityLabel(state)).toBe(label);
  });
});
