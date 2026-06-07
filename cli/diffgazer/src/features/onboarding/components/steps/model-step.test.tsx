import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type { ProviderModelsResponse } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../../app/providers/theme";
import { ModelStep } from "./model-step";

const GEMINI_CATALOG: ProviderModelsResponse = {
  models: [
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "1M ctx",
      tier: "free",
      recommended: true,
    },
    {
      id: "gemini-3-pro-preview",
      name: "Gemini 3 Pro Preview",
      description: "1M ctx",
      tier: "paid",
    },
  ],
  fetchedAt: new Date().toISOString(),
  source: "live",
  cached: false,
};

// Poll on a macrotask boundary so React Query's mocked resolution/rejection and
// the ink Spinner's real setInterval settle deterministically instead of racing
// the microtask-only setImmediate pump.
async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

function makeGeminiApi(): BoundApi {
  const getProviderModels = vi
    .fn<() => Promise<ProviderModelsResponse>>()
    .mockResolvedValue(GEMINI_CATALOG);
  return { ...createApi({ baseUrl: "http://localhost" }), getProviderModels } satisfies BoundApi;
}

function Wrapper({ children, api }: { children: ReactNode; api?: BoundApi }) {
  const queryClient = makeQueryClient();
  const boundApi = api ?? makeGeminiApi();
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={boundApi}>
        <CliThemeProvider initialTheme="dark">{children}</CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

describe("ModelStep (TUI catalog)", () => {
  afterEach(() => {
    cleanup();
  });

  test("lists catalog models with free and recommended badges", async () => {
    const { lastFrame } = render(
      <Wrapper>
        <ModelStep provider="gemini" value="gemini-2.5-flash" onChange={() => {}} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Gemini 2.5 Flash") ?? false);

    const frame = lastFrame();
    expect(frame).toContain("Gemini 2.5 Flash");
    expect(frame).toContain("Gemini 3 Pro Preview");
    expect(frame).toContain("free");
    expect(frame).toContain("recommended");
  });

  test("falls back to the manual model-id input when the catalog fetch fails", async () => {
    const getProviderModels = vi
      .fn<() => Promise<ProviderModelsResponse>>()
      .mockRejectedValue(new Error("catalog unavailable"));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelStep provider="gemini" value="openai/gpt-4o" onChange={() => {}} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Failed to load models") ?? false);

    const frame = lastFrame();
    expect(frame).toContain("Failed to load models: catalog unavailable");
    expect(frame).toContain("Enter a model ID manually");
    // The manual input renders the current value so the user can still proceed.
    expect(frame).toContain("openai/gpt-4o");
  });

  test("renders the model list for an inactive step instead of a stuck loading spinner", async () => {
    const { lastFrame } = render(
      <Wrapper>
        <ModelStep
          provider="gemini"
          value="gemini-2.5-flash"
          onChange={() => {}}
          isActive={false}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Gemini 2.5 Flash") ?? false);

    const frame = lastFrame();
    expect(frame).toContain("Gemini 2.5 Flash");
    expect(frame).not.toContain("Loading models");
  });

  test("shows the empty-state message when the catalog returns no models", async () => {
    const getProviderModels = vi.fn<() => Promise<ProviderModelsResponse>>().mockResolvedValue({
      models: [],
      fetchedAt: new Date().toISOString(),
      source: "snapshot",
      cached: true,
    });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelStep provider="gemini" onChange={() => {}} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("No models available") ?? false);

    expect(lastFrame()).toContain("No models available for this provider.");
  });
});
