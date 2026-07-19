import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider, configQueries, useSaveConfig } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type {
  AIProvider,
  OpenRouterModelsResponse,
  ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
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
  currentModel?: string | null;
  isSaving?: boolean;
  onSelect?: (modelId: string) => void;
  onOpenChange?: (open: boolean) => void;
  getProviderModels?: BoundApi["getProviderModels"];
  getOpenRouterModels?: BoundApi["getOpenRouterModels"];
}

function renderDialog(options: RenderOptions = {}) {
  const getProviderModels =
    options.getProviderModels ?? vi.fn<BoundApi["getProviderModels"]>().mockResolvedValue(RESPONSE);
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
  const currentModel =
    options.currentModel === null ? undefined : (options.currentModel ?? "gemini-2.5-flash");

  function DialogHarness() {
    const [open, setOpen] = useState(true);

    const handleOpenChange = (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange(nextOpen);
    };

    return (
      <ModelSelectDialog
        open={open}
        onOpenChange={handleOpenChange}
        provider={options.provider ?? "gemini"}
        currentModel={currentModel}
        isSaving={options.isSaving}
        onSelect={onSelect}
      />
    );
  }

  render(<DialogHarness />, { wrapper });
  return { getProviderModels, getOpenRouterModels, onSelect, onOpenChange };
}

describe("ModelSelectDialog (catalog)", () => {
  it("keeps the footer actions accessible when keyboard-only hints are capability-gated", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /Gemini 2\.5 Flash/ });
    expect(within(dialog).getByText("Search")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: /confirm/i })).toBeEnabled();
  });

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
      expect(screen.queryByRole("radio", { name: /Gemini 3 Pro Preview/ })).not.toBeInTheDocument(),
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

  it("fires onSelect with the chosen model when confirmed", async () => {
    const user = userEvent.setup();
    const { onSelect, onOpenChange } = renderDialog({ currentModel: "gemini-2.5-flash" });
    const targetRadio = await screen.findByRole("radio", { name: /Gemini 2\.5 Pro/ });

    await user.click(targetRadio);
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-pro");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows a saving state and disables confirmation while persistence is pending", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({ currentModel: "gemini-2.5-flash", isSaving: true });

    const dialog = await screen.findByRole("dialog");
    const savingButton = await waitFor(() =>
      within(dialog).getByRole("button", { name: /^saving/i }),
    );

    expect(savingButton).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /close dialog/i })).toBeDisabled();

    await user.keyboard("{Escape}");
    // fireEvent retained: jsdom does not synthesize the native dialog cancel event from Escape.
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    // fireEvent retained: explicit coordinates are required to exercise native backdrop hit testing.
    fireEvent.pointerDown(dialog, { clientX: -1, clientY: -1 });
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it("hands empty tier results to Cancel and dismisses from the recovery target", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const getProviderModels = vi.fn<BoundApi["getProviderModels"]>().mockResolvedValue({
      models: [
        {
          id: "free-only-model",
          name: "Free Only Model",
          description: "A free model",
          tier: "free",
        },
      ],
      fetchedAt: new Date().toISOString(),
      source: "live",
      cached: false,
    });

    renderDialog({
      currentModel: null,
      getProviderModels,
      onSelect,
      onOpenChange,
    });

    const model = await screen.findByRole("radio", { name: /Free Only Model/ });
    await user.click(model);

    // all -> free keeps the list mounted; free -> paid removes the focused list.
    await user.keyboard("f");
    await user.keyboard("f");

    const cancel = screen.getByRole("button", { name: /cancel/i });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(cancel).not.toBeDisabled();
    expect(document.activeElement).toBe(cancel);
    expect(screen.queryByRole("radio", { name: /Free Only Model/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /available models/i })).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ModelSelectDialog query states", () => {
  it("shows cached provenance and retries the catalog", async () => {
    const user = userEvent.setup();
    const getProviderModels = vi.fn<BoundApi["getProviderModels"]>().mockResolvedValue({
      ...RESPONSE,
      source: "cache",
      cached: true,
      fetchedAt: "2026-06-02T00:00:00.000Z",
    });
    renderDialog({ getProviderModels });

    expect(await screen.findByText(/using cached catalog data/i)).toHaveTextContent(
      "2026-06-02T00:00:00.000Z",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(getProviderModels).toHaveBeenCalledTimes(2));
  });

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
  it("shows the compatibility label without a custom-model affordance", async () => {
    renderDialog({ provider: "openrouter", currentModel: undefined });

    expect(
      await screen.findByText(/showing 1\/2 models that support structured outputs/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/custom model ID/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /use id/i })).not.toBeInTheDocument();
  });

  it("removes old-credential rows and blocks confirmation when the replacement fetch fails", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const getOpenRouterModels = vi
      .fn<BoundApi["getOpenRouterModels"]>()
      .mockRejectedValue(new Error("Replacement credential rejected"));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getOpenRouterModels,
      saveConfig: vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined),
    } satisfies BoundApi;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(configQueries.openRouterModels(api).queryKey, {
      models: [
        {
          id: "old/account-model",
          name: "Old account model",
          description: "Available only to the previous credential",
          contextLength: 4096,
          supportedParameters: ["response_format"],
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
        },
      ],
      fetchedAt: new Date().toISOString(),
      cached: false,
    } satisfies OpenRouterModelsResponse);

    function CredentialReplacementHarness() {
      const replacement = useSaveConfig();
      return (
        <>
          <button
            type="button"
            onClick={() =>
              replacement.mutate({ provider: "openrouter", apiKey: "replacement-key" })
            }
          >
            Replace credential
          </button>
          <ModelSelectDialog
            open
            onOpenChange={vi.fn()}
            provider="openrouter"
            currentModel="old/account-model"
            onSelect={onSelect}
          />
        </>
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <FooterProvider>
            <KeyboardProvider>
              <CredentialReplacementHarness />
            </KeyboardProvider>
          </FooterProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("radio", { name: /Old account model/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Replace credential" }));

    expect(await screen.findByText("Replacement credential rejected")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Old account model/ })).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
