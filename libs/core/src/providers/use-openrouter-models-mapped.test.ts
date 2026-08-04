/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, type Mock, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import type { ConfigurationModelsResponse, ModelInfo } from "../schemas/config/models.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import { createTestQueryWrapper } from "../testing/query-wrapper.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import {
  getCompatibilityLabel,
  useOpenRouterModelsMapped,
} from "./use-openrouter-models-mapped.js";

const checkedAt = "2026-08-02T12:00:00.000Z";
const openRouterNotice = PRODUCT_REGISTRY.openrouter.notice;

const configuration = {
  status: "supported",
  configurationId: "openrouter-primary",
  revision: 4,
  transportFamily: "hosted-api",
  productId: "openrouter",
  endpoint: "https://openrouter.ai/api/v1",
  selectedModelId: null,
  notices: [
    {
      ...openRouterNotice,
      billing: [...openRouterNotice.billing],
      privacy: [...openRouterNotice.privacy],
    },
  ],
  availableActions: ["inspect", "select", "test", "update", "delete"],
} as const satisfies ClientConfigurationSummary;

function model(id: string, tier: ModelInfo["tier"] = "paid"): ModelInfo {
  return { id, name: id, description: "128K context", tier };
}

function passedResponse(models: ModelInfo[]): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models,
    checkedAt,
    source: "snapshot",
    cached: false,
  };
}

function mockModels(
  response: ConfigurationModelsResponse,
): Mock<BoundApi["getConfigurationModels"]> {
  return vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue(response);
}

describe("useOpenRouterModelsMapped", () => {
  it("exposes exact pinned routes from the configuration catalog discovery", async () => {
    const getConfigurationModels = mockModels(
      passedResponse([
        model("anthropic/claude-sonnet-4"),
        model("meta-llama/llama-3.3-70b", "free"),
      ]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current).toMatchObject({
      configurationId: "openrouter-primary",
      productId: "openrouter",
      transportFamily: "hosted-api",
      total: 2,
      pinned: 2,
      checkedAt,
    });
    expect(result.current.models.map(({ id }) => id)).toEqual([
      "anthropic/claude-sonnet-4",
      "meta-llama/llama-3.3-70b",
    ]);
    expect(getConfigurationModels).toHaveBeenCalledWith("openrouter-primary");
    expect(getCompatibilityLabel(result.current)).toBe("Showing 2 exact pinned downstream routes.");
  });

  it.each([
    "openrouter/auto",
    "provider/fallback",
    "meta-llama/llama-3.3-70b:free",
    "gpt-4.1-mini",
    "anthropic/claude-latest",
  ] as const)("never exposes the unpinned catalog route %s", async (unpinnedId) => {
    const getConfigurationModels = mockModels(
      passedResponse([model("anthropic/claude-sonnet-4"), model(unpinnedId)]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual(["anthropic/claude-sonnet-4"]);
    expect(result.current).toMatchObject({ total: 1, pinned: 1 });
  });

  it.each([
    "freeform/model",
    "provider/fallback-v2",
    "automaticity/model",
  ] as const)("preserves exact route segments that only contain a reserved selector: %s", async (pinnedId) => {
    const getConfigurationModels = mockModels(passedResponse([model(pinnedId)]));
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("passed"));

    expect(result.current.models.map(({ id }) => id)).toEqual([pinnedId]);
    expect(result.current).toMatchObject({ total: 1, pinned: 1 });
  });

  it("fails closed when no catalog route is an exact pinned downstream route", async () => {
    const getConfigurationModels = mockModels(
      passedResponse([model("openrouter/auto"), model("provider/thinking")]),
    );
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.models).toEqual([]);
    expect(result.current).toMatchObject({ total: 0, pinned: 0 });
    expect(result.current.error).toBe(
      "The tested OpenRouter model is not an exact pinned downstream route.",
    );
    expect(getCompatibilityLabel(result.current)).toBe(
      "No exact pinned downstream routes available.",
    );
  });

  it("keeps skipped catalog discovery empty without substituting routes", async () => {
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue({
      status: "skipped",
      configurationId: configuration.configurationId,
      productId: configuration.productId,
      transportFamily: configuration.transportFamily,
      models: [],
      checkedAt,
      reason: "No catalog models are available for this configuration product.",
    });
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(true, configuration), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("skipped"));

    expect(result.current.models).toEqual([]);
    expect(result.current).toMatchObject({ total: 0, pinned: 0 });
    expect(result.current.reason).toBe(
      "No catalog models are available for this configuration product.",
    );
  });

  it("stays idle without fetching while closed", () => {
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>();
    const { Wrapper } = createTestQueryWrapper({ api: { getConfigurationModels } });
    const { result } = renderHook(() => useOpenRouterModelsMapped(false, configuration), {
      wrapper: Wrapper,
    });

    expect(result.current).toMatchObject({
      status: "idle",
      models: [],
      total: 0,
      pinned: 0,
    });
    expect(getConfigurationModels).not.toHaveBeenCalled();
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
