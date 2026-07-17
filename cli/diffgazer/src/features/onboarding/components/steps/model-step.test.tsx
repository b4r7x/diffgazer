import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type {
  OpenRouterModelsResponse,
  ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../../theme/provider";
import { ModelStep } from "./model-step";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

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

const LARGE_CATALOG_SIZE = 24;

function makeLargeGeminiCatalog(): ProviderModelsResponse {
  return {
    models: Array.from({ length: LARGE_CATALOG_SIZE }, (_, index) => ({
      id: `gemini-large-${String(index)}`,
      name: `Gemini Large ${String(index).padStart(2, "0")}`,
      description: "Large catalog fixture",
      tier: index % 2 === 0 ? "free" : "paid",
    })),
    fetchedAt: new Date().toISOString(),
    source: "live",
    cached: false,
  };
}

function makeLargeOpenRouterCatalog(): OpenRouterModelsResponse {
  return {
    models: Array.from({ length: LARGE_CATALOG_SIZE }, (_, index) => ({
      id: `vendor/openrouter-large-${String(index)}`,
      name: `OpenRouter Large ${String(index).padStart(2, "0")}`,
      description: "Large catalog fixture",
      contextLength: 128_000,
      supportedParameters: ["response_format"],
      pricing: { prompt: "0", completion: "0" },
      isFree: index % 2 === 0,
    })),
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
}

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
    terminalDimensions.current = { columns: 80, rows: 24 };
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

  test("offers retry without manual model entry when the catalog fetch fails", async () => {
    const getProviderModels = vi
      .fn<() => Promise<ProviderModelsResponse>>()
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValueOnce(GEMINI_CATALOG);
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;

    const { lastFrame, stdin } = render(
      <Wrapper api={api}>
        <ModelStep provider="gemini" value="openai/gpt-4o" onChange={() => {}} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Failed to load models") ?? false);

    const frame = lastFrame();
    expect(frame).toContain("Failed to load models: catalog unavailable");
    expect(frame).toContain("Press r to retry");
    expect(frame).not.toContain("Enter a model ID manually");

    stdin.write("r");
    await flushUntil(() => lastFrame()?.includes("Gemini 2.5 Flash") ?? false);
    expect(getProviderModels).toHaveBeenCalledTimes(2);
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

  test.each([
    {
      provider: "gemini" as const,
      firstName: "Gemini Large 00",
      targetName: "Gemini Large 08",
      targetId: "gemini-large-8",
      names: makeLargeGeminiCatalog().models.map((model) => model.name),
      api: {
        ...createApi({ baseUrl: "http://localhost" }),
        getProviderModels: vi.fn().mockResolvedValue(makeLargeGeminiCatalog()),
      } satisfies BoundApi,
    },
    {
      provider: "openrouter" as const,
      firstName: "OpenRouter Large 00",
      targetName: "OpenRouter Large 08",
      targetId: "vendor/openrouter-large-8",
      names: makeLargeOpenRouterCatalog().models.map((model) => model.name),
      api: {
        ...createApi({ baseUrl: "http://localhost" }),
        getOpenRouterModels: vi.fn().mockResolvedValue(makeLargeOpenRouterCatalog()),
      } satisfies BoundApi,
    },
  ])("keeps the highlighted $provider model visible beyond the first terminal viewport", async ({
    provider,
    firstName,
    targetName,
    targetId,
    names,
    api,
  }) => {
    terminalDimensions.current = { columns: 80, rows: 18 };
    const onChange = vi.fn();
    const view = render(
      <Wrapper api={api}>
        <ModelStep provider={provider} onChange={onChange} />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes(firstName) ?? false);
    expect(view.lastFrame()).not.toContain(targetName);
    expect(names.filter((name) => view.lastFrame()?.includes(name))).toHaveLength(6);

    for (let index = 0; index < 8; index += 1) {
      view.stdin.write("\u001b[B");
      await new Promise((resolve) => setImmediate(resolve));
    }
    await flushUntil(() => view.lastFrame()?.includes(targetName) ?? false);

    expect(view.lastFrame()).toContain(targetName);
    expect(view.lastFrame()).not.toContain(firstName);
    expect(names.filter((name) => view.lastFrame()?.includes(name))).toHaveLength(6);
    view.stdin.write("\r");
    await flushUntil(() => onChange.mock.calls.length > 0);
    expect(onChange).toHaveBeenCalledWith(targetId);
  });
});
