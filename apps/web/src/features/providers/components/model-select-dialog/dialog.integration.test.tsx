import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type {
  AIProvider,
  OpenRouterModelsResponse,
  ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModelSelectDialog } from "./dialog";

const RESPONSE: ProviderModelsResponse = {
  models: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "1M context", tier: "free" },
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

const OPENROUTER_RESPONSE: OpenRouterModelsResponse = {
  models: [
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      description: "Supports structured outputs",
      contextLength: 128000,
      supportedParameters: ["response_format"],
      pricing: { prompt: "0.001", completion: "0.002" },
      isFree: false,
    },
    {
      id: "meta/llama-3-free",
      name: "Llama 3 Free",
      description: "No structured outputs",
      contextLength: 8000,
      supportedParameters: ["temperature"],
      pricing: { prompt: "0", completion: "0" },
      isFree: true,
    },
  ],
  fetchedAt: new Date().toISOString(),
  cached: false,
};

interface RenderOptions {
  provider?: AIProvider;
  currentModel?: string;
  onSelect?: (modelId: string) => void;
  onOpenChange?: (open: boolean) => void;
  getProviderModels?: BoundApi["getProviderModels"];
  getOpenRouterModels?: BoundApi["getOpenRouterModels"];
}

function renderDialog(options: RenderOptions = {}) {
  const getProviderModels =
    options.getProviderModels ??
    vi.fn<BoundApi["getProviderModels"]>().mockResolvedValue(RESPONSE);
  const getOpenRouterModels =
    options.getOpenRouterModels ??
    vi.fn<BoundApi["getOpenRouterModels"]>().mockResolvedValue(OPENROUTER_RESPONSE);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    getProviderModels,
    getOpenRouterModels,
  } satisfies BoundApi;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <FooterProvider>
          <KeyboardProvider>{children}</KeyboardProvider>
        </FooterProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
  const onSelect = options.onSelect ?? vi.fn();
  const onOpenChange = options.onOpenChange ?? vi.fn();
  render(
    <ModelSelectDialog
      open
      onOpenChange={onOpenChange}
      provider={options.provider ?? "gemini"}
      currentModel={options.currentModel ?? "gemini-2.5-flash"}
      onSelect={onSelect}
    />,
    { wrapper },
  );
  return { getProviderModels, getOpenRouterModels, onSelect, onOpenChange };
}

describe("ModelSelectDialog (catalog)", () => {
  it("renders catalog models free-first with a free badge", async () => {
    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Gemini 2\.5 Flash/ })).toBeInTheDocument(),
    );
    const modelList = screen.getByRole("radiogroup", { name: /available models/i });
    const order = within(modelList)
      .getAllByRole("radio")
      .map((el) => el.getAttribute("data-value"));
    expect(order).toEqual(["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-pro-preview"]);
    expect(screen.getByRole("radio", { name: /Gemini 2\.5 Flash/ })).toHaveTextContent(/free/i);
    expect(screen.getByRole("radio", { name: /Gemini 3 Pro Preview/ })).toHaveTextContent(/paid/i);
  });

  it("narrows to free-only when the free tier filter is selected", async () => {
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Gemini 3 Pro Preview/ })).toBeInTheDocument(),
    );

    const filterTabs = screen.getByRole("radiogroup", { name: /model tier filter/i });
    await user.click(within(filterTabs).getByRole("radio", { name: /^free$/i }));

    expect(within(filterTabs).getByRole("radio", { name: /^free$/i })).toBeChecked();
    await waitFor(() =>
      expect(
        screen.queryByRole("radio", { name: /Gemini 3 Pro Preview/ }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("radio", { name: /Gemini 2\.5 Flash/ })).toBeInTheDocument();
  });

  it("pre-checks the current model when the dialog opens", async () => {
    renderDialog({ currentModel: "gemini-2.5-pro" });
    const checkedRadio = await screen.findByRole("radio", { name: /Gemini 2\.5 Pro/ });
    expect(checkedRadio).toBeChecked();
    expect(screen.getByRole("radio", { name: /Gemini 2\.5 Flash/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Gemini 3 Pro Preview/ })).not.toBeChecked();
  });

  it("fires onSelect with the chosen model and closes when confirmed", async () => {
    const user = userEvent.setup();
    const { onSelect, onOpenChange } = renderDialog({ currentModel: "gemini-2.5-flash" });
    const targetRadio = await screen.findByRole("radio", { name: /Gemini 2\.5 Pro/ });

    await user.click(targetRadio);
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-pro");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ModelSelectDialog query states", () => {
  it("renders the error text when the catalog query rejects", async () => {
    renderDialog({
      getProviderModels: vi
        .fn<BoundApi["getProviderModels"]>()
        .mockRejectedValue(new Error("Catalog unavailable")),
    });
    expect(await screen.findByText(/Catalog unavailable/)).toBeInTheDocument();
  });

  it("renders the loading state while the catalog query is pending", async () => {
    renderDialog({
      getProviderModels: vi
        .fn<BoundApi["getProviderModels"]>()
        .mockReturnValue(new Promise<ProviderModelsResponse>(() => {})),
    });
    expect(await screen.findByText(/loading models/i)).toBeInTheDocument();
  });

  it("renders the empty label when the catalog resolves with no models", async () => {
    renderDialog({
      getProviderModels: vi.fn<BoundApi["getProviderModels"]>().mockResolvedValue({
        models: [],
        fetchedAt: new Date().toISOString(),
        source: "snapshot",
        cached: false,
      }),
    });
    expect(await screen.findByText(/no models match your search/i)).toBeInTheDocument();
  });
});

describe("ModelSelectDialog (OpenRouter)", () => {
  it("shows the compatibility label and the custom-model affordance", async () => {
    renderDialog({ provider: "openrouter", currentModel: undefined });

    expect(
      await screen.findByText(/showing 1\/2 models that support structured outputs/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/enter a custom model ID at your own risk/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use id/i })).toBeInTheDocument();
  });
});
