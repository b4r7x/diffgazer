import { type BoundApi, createApi } from "@diffgazer/core/api";
import type {
  OpenRouterModelsResponse,
  ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ModelSelectOverlay } from "./model-select-overlay";
import {
  flushUntil,
  GEMINI_CATALOG,
  geminiName,
  Wrapper,
} from "./model-select-overlay.test-harness";

const OPENROUTER_MODELS: OpenRouterModelsResponse = {
  models: [
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      description: "Flagship",
      contextLength: 128000,
      supportedParameters: ["response_format"],
      pricing: { prompt: "0", completion: "0" },
      isFree: false,
    },
    {
      id: "anthropic/claude-3.5",
      name: "Claude 3.5",
      description: "Anthropic",
      contextLength: 200000,
      supportedParameters: ["response_format"],
      pricing: { prompt: "0", completion: "0" },
      isFree: false,
    },
  ],
  fetchedAt: new Date().toISOString(),
  cached: false,
};

describe("ModelSelectOverlay OpenRouter compatibility", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the OpenRouter structured-output compatibility label", async () => {
    const getOpenRouterModels = vi
      .fn<() => Promise<OpenRouterModelsResponse>>()
      .mockResolvedValue(OPENROUTER_MODELS);
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getOpenRouterModels,
    } satisfies BoundApi;

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="openrouter"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("GPT-4o") ?? false);

    expect(lastFrame()).toContain("structured outputs");
  });
});

describe("ModelSelectOverlay catalog provenance", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows cached provenance and retries with r", async () => {
    const getProviderModels = vi.fn<() => Promise<ProviderModelsResponse>>().mockResolvedValue({
      ...GEMINI_CATALOG,
      source: "cache",
      cached: true,
      fetchedAt: "2026-06-02T00:00:00.000Z",
    });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;
    const { lastFrame, stdin } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Using cached catalog data") ?? false);
    const fallbackFrame = lastFrame() ?? "";
    expect(fallbackFrame).toContain("2026-06-02T00:00:00.000Z");
    expect(fallbackFrame).toContain("Tab: zone");
    expect(fallbackFrame.split("\n")).toHaveLength(20);

    stdin.write("r");
    await flushUntil(() => getProviderModels.mock.calls.length === 2);
    expect(getProviderModels).toHaveBeenCalledTimes(2);
  });

  test("recovers the model list after retrying a rejected catalog query", async () => {
    const getProviderModels = vi
      .fn<() => Promise<ProviderModelsResponse>>()
      .mockRejectedValueOnce(new Error("Catalog unavailable"))
      .mockResolvedValueOnce(GEMINI_CATALOG);
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;
    const { lastFrame, stdin } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Catalog unavailable") ?? false);
    const errorFrame = lastFrame() ?? "";
    expect(errorFrame).toContain("Catalog unavailable");
    expect(errorFrame).toContain("Press r to retry");

    stdin.write("r");
    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    expect(getProviderModels).toHaveBeenCalledTimes(2);
    expect(lastFrame()).not.toContain("Catalog unavailable");
  });
});
