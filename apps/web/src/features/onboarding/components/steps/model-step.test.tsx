import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type {
  OpenRouterModelsResponse,
  ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { escapeRegExp } from "@/testing/escape-regexp";
import { ModelStep } from "./model-step";

const GEMINI_CATALOG: ProviderModelsResponse = {
  models: [
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "1M context",
      tier: "free",
      recommended: true,
    },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "1M context", tier: "free" },
    {
      id: "gemini-3-pro-preview",
      name: "Gemini 3 Pro Preview",
      description: "1M context",
      tier: "paid",
    },
  ],
  fetchedAt: new Date().toISOString(),
  source: "live",
  cached: false,
};

function geminiModel(id: string) {
  const model = GEMINI_CATALOG.models.find((m) => m.id === id);
  if (!model) throw new Error(`Gemini catalog fixture is missing model "${id}"`);
  return model;
}

function makeWrapper(api: BoundApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <FooterProvider>
          <KeyboardProvider>{children}</KeyboardProvider>
        </FooterProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function renderGemini(props: {
  value: string | null;
  onChange?: (model: string) => void;
  onCommit?: (model: string) => void;
}) {
  const getProviderModels = vi
    .fn<() => Promise<ProviderModelsResponse>>()
    .mockResolvedValue(GEMINI_CATALOG);
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    getProviderModels,
  } satisfies BoundApi;
  render(
    <ModelStep
      provider="gemini"
      value={props.value}
      onChange={props.onChange ?? vi.fn()}
      onCommit={props.onCommit ?? vi.fn()}
    />,
    { wrapper: makeWrapper(api) },
  );
  return { getProviderModels };
}

describe("ModelStep", () => {
  it("exposes the model-loading branch as a status region", async () => {
    const getProviderModels = vi
      .fn<() => Promise<ProviderModelsResponse>>()
      .mockReturnValue(new Promise<ProviderModelsResponse>(() => {}));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;

    render(<ModelStep provider="gemini" value={null} onChange={vi.fn()} onCommit={vi.fn()} />, {
      wrapper: makeWrapper(api),
    });

    // F-353(b): the loading branch announces via role="status" instead of plain text.
    expect(await screen.findByRole("status")).toHaveTextContent(/loading models/i);
  });

  it("announces a catalog rejection and retries without offering manual entry", async () => {
    const getProviderModels = vi.fn<() => Promise<ProviderModelsResponse>>().mockImplementation(
      () =>
        new Promise<ProviderModelsResponse>((_resolve, reject) => {
          setTimeout(() => reject(new Error("catalog unavailable")), 0);
        }),
    );
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;

    render(<ModelStep provider="gemini" value={null} onChange={vi.fn()} onCommit={vi.fn()} />, {
      wrapper: makeWrapper(api),
    });

    expect(screen.getByRole("status")).toHaveTextContent(/loading models/i);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to load models: catalog unavailable/i,
    );
    expect(screen.queryByRole("textbox", { name: "Model ID" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    await vi.waitFor(() => expect(getProviderModels).toHaveBeenCalledTimes(2));
  });

  it("commits the current selected catalog model when Enter is pressed", async () => {
    const selectedModel = geminiModel("gemini-2.5-pro");
    const user = userEvent.setup();
    const onCommit = vi.fn();

    renderGemini({ value: selectedModel.id, onCommit });

    const modelGroup = await screen.findByRole("radiogroup", { name: /available models/i });
    const selectedRadio = within(modelGroup).getByRole("radio", {
      name: new RegExp(escapeRegExp(selectedModel.name)),
    });

    selectedRadio.focus();
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith(selectedModel.id);
  });

  it("commits the highlighted catalog model after keyboard navigation", async () => {
    const selectedModel = geminiModel("gemini-2.5-flash");
    const highlightedModel = geminiModel("gemini-2.5-pro");
    const user = userEvent.setup();
    const onCommit = vi.fn();

    renderGemini({ value: selectedModel.id, onCommit });

    const modelGroup = await screen.findByRole("radiogroup", { name: /available models/i });
    const selectedRadio = within(modelGroup).getByRole("radio", {
      name: new RegExp(escapeRegExp(selectedModel.name)),
    });

    selectedRadio.focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onCommit).toHaveBeenCalledWith(highlightedModel.id);
  });

  it("renders the recommended and tier badges from the catalog", async () => {
    renderGemini({ value: "gemini-2.5-flash" });

    const modelGroup = await screen.findByRole("radiogroup", { name: /available models/i });
    const flashRadio = within(modelGroup).getByRole("radio", { name: /Gemini 2\.5 Flash/ });
    expect(flashRadio).toHaveTextContent(/recommended/i);
    expect(flashRadio).toHaveTextContent(/free/i);
  });

  it("shows snapshot provenance and retries an empty fallback catalog", async () => {
    const user = userEvent.setup();
    const getProviderModels = vi.fn<() => Promise<ProviderModelsResponse>>().mockResolvedValue({
      models: [],
      fetchedAt: new Date().toISOString(),
      source: "snapshot",
      cached: false,
    });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;

    render(<ModelStep provider="gemini" value={null} onChange={vi.fn()} onCommit={vi.fn()} />, {
      wrapper: makeWrapper(api),
    });

    expect(await screen.findByText(/using the bundled model catalog/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(getProviderModels).toHaveBeenCalledTimes(2);
  });

  it("does not offer manual OpenRouter entry when no models are available", async () => {
    const mockGetOpenRouterModels = vi
      .fn<() => Promise<OpenRouterModelsResponse>>()
      .mockResolvedValue({
        models: [],
        fetchedAt: new Date().toISOString(),
        cached: false,
      });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getOpenRouterModels: mockGetOpenRouterModels,
    } satisfies BoundApi;

    render(<ModelStep provider="openrouter" value={null} onChange={vi.fn()} onCommit={vi.fn()} />, {
      wrapper: makeWrapper(api),
    });

    expect(await screen.findByText(/no models available/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /model id/i })).not.toBeInTheDocument();
  });

  it("commits the first available OpenRouter model after models load", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const mockGetOpenRouterModels = vi.fn<() => Promise<OpenRouterModelsResponse>>();

    mockGetOpenRouterModels.mockResolvedValue({
      models: [
        {
          id: "openrouter/model-a",
          name: "OpenRouter Model A",
          description: "A description",
          contextLength: 128000,
          supportedParameters: ["response_format"],
          pricing: { prompt: "0", completion: "0" },
          isFree: false,
        },
        {
          id: "openrouter/model-b",
          name: "OpenRouter Model B",
          description: "B description",
          contextLength: 128000,
          supportedParameters: ["response_format"],
          pricing: { prompt: "0", completion: "0" },
          isFree: false,
        },
      ],
      fetchedAt: new Date().toISOString(),
      cached: false,
    });

    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getOpenRouterModels: mockGetOpenRouterModels,
    } satisfies BoundApi;

    render(
      <ModelStep provider="openrouter" value={null} onChange={vi.fn()} onCommit={onCommit} />,
      { wrapper: makeWrapper(api) },
    );

    const modelGroup = await screen.findByRole("radiogroup", { name: /available models/i });
    const firstRadio = within(modelGroup).getByRole("radio", { name: /OpenRouter Model A/ });

    firstRadio.focus();
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith("openrouter/model-a");
  });
});
