import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type {
  OpenRouterModelsResponse,
  ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
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
  it("commits the current selected catalog model when Enter is pressed", async () => {
    const selectedModel = geminiModel("gemini-2.5-pro");
    const user = userEvent.setup();
    const onCommit = vi.fn();

    renderGemini({ value: selectedModel.id, onCommit });

    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: new RegExp(escapeRegExp(selectedModel.name)) }),
      ).toBeInTheDocument(),
    );
    screen.getByRole("radio", { name: new RegExp(escapeRegExp(selectedModel.name)) }).focus();
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith(selectedModel.id);
  });

  it("commits the highlighted catalog model after keyboard navigation", async () => {
    const selectedModel = geminiModel("gemini-2.5-flash");
    const highlightedModel = geminiModel("gemini-2.5-pro");
    const user = userEvent.setup();
    const onCommit = vi.fn();

    renderGemini({ value: selectedModel.id, onCommit });

    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: new RegExp(escapeRegExp(selectedModel.name)) }),
      ).toBeInTheDocument(),
    );
    screen.getByRole("radio", { name: new RegExp(escapeRegExp(selectedModel.name)) }).focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onCommit).toHaveBeenCalledWith(highlightedModel.id);
  });

  it("renders the recommended and tier badges from the catalog", async () => {
    renderGemini({ value: "gemini-2.5-flash" });

    const flashRadio = await screen.findByRole("radio", { name: /Gemini 2\.5 Flash/ });
    expect(flashRadio).toHaveTextContent(/recommended/i);
    expect(flashRadio).toHaveTextContent(/free/i);
  });

  it("offers a manual model-id input when the catalog resolves with no models", async () => {
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

    function Harness() {
      const [model, setModel] = useState<string | null>(null);
      return <ModelStep provider="gemini" value={model} onChange={setModel} onCommit={vi.fn()} />;
    }

    render(<Harness />, { wrapper: makeWrapper(api) });

    const input = await screen.findByPlaceholderText("gemini-2.5-flash");
    await user.type(input, "gemini-custom");

    expect(input).toHaveValue("gemini-custom");
  });

  it("commits the selected OpenRouter model after models load", async () => {
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
      <ModelStep
        provider="openrouter"
        value="openrouter/model-b"
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
      { wrapper: makeWrapper(api) },
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /OpenRouter Model B/ })).toBeInTheDocument();
    });

    screen.getByRole("radio", { name: /OpenRouter Model B/ }).focus();
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith("openrouter/model-b");
  });
});
