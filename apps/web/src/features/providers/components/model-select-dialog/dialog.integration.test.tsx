import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
  ModelInfo,
} from "@diffgazer/core/schemas/config";
import { READY_GEMINI_CONFIGURATION } from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModelSelectDialog } from "./dialog";

const CHECKED_AT = "2026-08-02T12:00:00.000Z";
const CATALOG_SKIPPED_REASON =
  "Catalog observations are unavailable for this configuration product.";

function catalogModel(id: string, tier: ModelInfo["tier"] = "paid"): ModelInfo {
  return { id, name: id, description: "128K context", tier };
}

function catalogModelsResponse(
  configuration: ClientConfigurationSummary,
  models: ModelInfo[],
): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models,
    checkedAt: CHECKED_AT,
    source: "snapshot",
    cached: false,
  };
}

function skippedModelsResponse(
  configuration: ClientConfigurationSummary,
  reason: string = CATALOG_SKIPPED_REASON,
): ConfigurationModelsResponse {
  return {
    status: "skipped",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models: [],
    checkedAt: CHECKED_AT,
    reason,
  };
}

const GEMINI_CONFIGURATION = READY_GEMINI_CONFIGURATION as ClientConfigurationSummary;
const GEMINI_CATALOG_MODELS = [catalogModel("gemini-2.5-flash"), catalogModel("gemini-2.5-pro")];

interface RenderOptions {
  configuration?: ClientConfigurationSummary;
  currentModel?: string | null;
  isSaving?: boolean;
  /** Flip isSaving to true when a selection is confirmed, like the page container does. */
  saveOnSelect?: boolean;
  onSelect?: (modelId: string) => void;
  onOpenChange?: (open: boolean) => void;
  getConfigurationModels?: BoundApi["getConfigurationModels"];
}

function renderDialog(options: RenderOptions = {}) {
  const configuration = options.configuration ?? GEMINI_CONFIGURATION;
  const getConfigurationModels =
    options.getConfigurationModels ??
    vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(configuration, GEMINI_CATALOG_MODELS));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    getConfigurationModels,
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

  let setSaving: ((saving: boolean) => void) | undefined;

  function DialogHarness() {
    const [open, setOpen] = useState(true);
    const [isSaving, setIsSaving] = useState(options.isSaving ?? false);
    setSaving = setIsSaving;

    const handleOpenChange = (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange(nextOpen);
    };

    const handleSelect = (modelId: string) => {
      onSelect(modelId);
      if (options.saveOnSelect) setIsSaving(true);
    };

    return (
      <ModelSelectDialog
        open={open}
        onOpenChange={handleOpenChange}
        configuration={configuration}
        currentModel={currentModel}
        isSaving={isSaving}
        onSelect={handleSelect}
      />
    );
  }

  render(<DialogHarness />, { wrapper });
  return { getConfigurationModels, onSelect, onOpenChange, finishSave: () => setSaving?.(false) };
}

describe("ModelSelectDialog configuration-bound discovery", () => {
  it("keeps the footer actions accessible alongside the key legend", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: /confirm/i })).toBeEnabled();
  });

  it("renders a header strip with the title and exactly one close control", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    const heading = within(dialog).getByRole("heading", { name: "Select Model" });
    const header = heading.closest('[data-slot="dialog-header"]');

    expect(header).toBeInstanceOf(HTMLElement);
    expect(header).toHaveTextContent(/gemini/i);
    expect(within(dialog).getAllByRole("button", { name: /close dialog/i })).toHaveLength(1);
  });

  it("teaches the list keys with the fine-pointer key legend", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    const legend = within(dialog).getByText("Space").closest('[data-slot="overlay-hints"]');
    expect(legend).toBeInstanceOf(HTMLElement);

    const hints = within(legend as HTMLElement);
    expect(hints.getByText("Navigate")).toBeInTheDocument();
    expect(hints.getByText("Search")).toBeInTheDocument();
    expect(hints.getByText("Filter")).toBeInTheDocument();
    expect(hints.getByText("Select")).toBeInTheDocument();
    // Enter/Esc live on the visible [Confirm]/[Cancel] buttons, not the legend,
    // so the legend fits one footer row beside the actions.
    expect(hints.queryByText("Enter")).not.toBeInTheDocument();
    expect(hints.queryByText("Esc")).not.toBeInTheDocument();
  });

  it("lists every catalog candidate model with the count and checked time", async () => {
    renderDialog();

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/ })).toBeInTheDocument(),
    );
    const modelList = screen.getByRole("radiogroup", { name: /available models/i });
    expect(within(modelList).getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText(/2 models/)).toBeInTheDocument();
    expect(screen.getByText(/checked/i)).toBeInTheDocument();
    // No amber discovery strip on a passed catalog response.
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText(/using cached catalog data/i)).not.toBeInTheDocument();
  });

  it("narrows to an empty list when the tier filter excludes every model", async () => {
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/ })).toBeInTheDocument(),
    );

    const filterTabs = screen.getByRole("radiogroup", { name: /model tier filter/i });
    await user.click(within(filterTabs).getByRole("radio", { name: /^free$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("radio", { name: /gemini-2\.5-flash/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/no models match your search/i);
  });

  it("pre-checks the current exact model when the dialog opens", async () => {
    renderDialog({ currentModel: "gemini-2.5-flash" });
    const checkedRadio = await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });
    expect(checkedRadio).toBeChecked();
  });

  it("fires onSelect with the exact configuration model ID when confirmed", async () => {
    const user = userEvent.setup();
    const { onSelect, onOpenChange } = renderDialog({ currentModel: "gemini-2.5-flash" });
    await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash");
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
    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    // fireEvent retained: outside-click dismissal needs exact client coordinates vs dialog bounds.
    fireEvent.pointerDown(dialog, { clientX: -1, clientY: -1 });
    // fireEvent retained: outside-click dismissal needs exact client coordinates vs dialog bounds.
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it("keeps DOM focus inside the open dialog for the whole saving window", async () => {
    const user = userEvent.setup();
    renderDialog({ currentModel: "gemini-2.5-flash", saveOnSelect: true });

    const dialog = await screen.findByRole("dialog");
    const currentRow = await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    await waitFor(() => expect(currentRow).toHaveFocus());

    await user.keyboard("{Enter}");

    // The focused radio unmounts the moment saving starts and every footer
    // control is disabled; focus must not fall to document.body.
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("Saving..."));
    expect(
      within(dialog).queryByRole("radio", { name: /gemini-2\.5-flash/ }),
    ).not.toBeInTheDocument();
    // Not the dialog root either: that is only jsdom's focus-trap recapture
    // fallback (real browsers fire no focus events when the focused row is
    // removed and drop to body), so the save window must park focus on a
    // stable element inside the dialog.
    await waitFor(() => {
      const active = document.activeElement;
      expect(dialog.contains(active)).toBe(true);
      expect(active).not.toBe(dialog);
      expect(active).not.toBe(document.body);
    });
  });

  it("keeps keys quiet while saving and returns focus to the model row when saving fails", async () => {
    const user = userEvent.setup();
    const { finishSave } = renderDialog({ currentModel: "gemini-2.5-flash", saveOnSelect: true });

    const dialog = await screen.findByRole("dialog");
    const currentRow = await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    await waitFor(() => expect(currentRow).toHaveFocus());

    await user.keyboard("{Enter}");
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("Saving..."));

    // f must not cycle the tier filter and / must not move the zone into the
    // disabled search box while the save window is open.
    await user.keyboard("f");
    await user.keyboard("/");

    act(() => finishSave());

    const filterTabs = screen.getByRole("radiogroup", { name: /model tier filter/i });
    expect(within(filterTabs).getByRole("radio", { name: /^all$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const restoredRow = await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    await waitFor(() => expect(restoredRow).toHaveFocus());

    // The list zone is live again after the failed save: j moves down a row.
    await user.keyboard("j");
    expect(within(dialog).getByRole("radio", { name: /gemini-2\.5-pro/ })).toHaveFocus();
  });
});

describe("ModelSelectDialog discovery states", () => {
  it("shows the skipped catalog reason with checkedAt and retries discovery", async () => {
    const user = userEvent.setup();
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(skippedModelsResponse(GEMINI_CONFIGURATION));
    renderDialog({ getConfigurationModels });

    // The alert row is the single discovery surface: the message renders once and
    // exactly one live region announces it, while the list keeps generic copy.
    expect(await screen.findAllByText(CATALOG_SKIPPED_REASON)).toHaveLength(1);
    expect(
      screen
        .getAllByRole("status")
        .filter((region) => region.textContent?.includes(CATALOG_SKIPPED_REASON)),
    ).toHaveLength(1);
    expect(screen.getByText("No models available")).toBeInTheDocument();
    expect(screen.getByText(/checked/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(getConfigurationModels).toHaveBeenCalledTimes(2));
  });

  it("renders the failed discovery message exactly once when the models query rejects", async () => {
    renderDialog({
      getConfigurationModels: vi
        .fn<BoundApi["getConfigurationModels"]>()
        .mockRejectedValue(new Error("Catalog unavailable")),
    });

    const failureMessage = "Model discovery failed. Test the configuration again.";
    expect(await screen.findAllByText(failureMessage)).toHaveLength(1);
    expect(screen.getByText("No models available")).toBeInTheDocument();
  });

  it("renders the loading state while discovery is pending", async () => {
    renderDialog({
      getConfigurationModels: vi
        .fn<BoundApi["getConfigurationModels"]>()
        .mockReturnValue(new Promise<ConfigurationModelsResponse>(() => {})),
    });
    expect(await screen.findByText(/loading models/i)).toBeInTheDocument();
  });

  it("focuses the current model row once discovery resolves and drives the list with j/k", async () => {
    const user = userEvent.setup();
    let resolveModels!: (response: ConfigurationModelsResponse) => void;
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>().mockReturnValue(
      new Promise<ConfigurationModelsResponse>((resolve) => {
        resolveModels = resolve;
      }),
    );
    renderDialog({ currentModel: "gemini-2.5-pro", getConfigurationModels });

    // While discovery is pending, open-time autofocus lands wherever the focus
    // trap puts it; the dialog must repair to the current model afterwards.
    expect(await screen.findByText(/loading models/i)).toBeInTheDocument();

    await act(async () => {
      resolveModels(catalogModelsResponse(GEMINI_CONFIGURATION, GEMINI_CATALOG_MODELS));
    });

    const currentRow = await screen.findByRole("radio", { name: /gemini-2\.5-pro/ });
    await waitFor(() => expect(currentRow).toHaveFocus());

    await user.keyboard("k");
    expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/ })).toHaveFocus();

    await user.keyboard("j");
    expect(currentRow).toHaveFocus();
  });

  it("keeps Navigate keypresses during the loading window from stranding focus outside the list", async () => {
    const user = userEvent.setup();
    let resolveModels!: (response: ConfigurationModelsResponse) => void;
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>().mockReturnValue(
      new Promise<ConfigurationModelsResponse>((resolve) => {
        resolveModels = resolve;
      }),
    );
    renderDialog({ currentModel: "gemini-2.5-pro", getConfigurationModels });

    expect(await screen.findByText(/loading models/i)).toBeInTheDocument();

    // Native <dialog> autofocus parks on [Cancel] while search and the tier
    // filters are disabled during discovery.
    const cancel = screen.getByRole("button", { name: /cancel/i });
    act(() => cancel.focus());
    expect(cancel).toHaveFocus();

    // The footer advertises "j/k Navigate"; pressing them while the list does
    // not exist yet must not consume the initial-focus window.
    await user.keyboard("k");
    await user.keyboard("j");

    await act(async () => {
      resolveModels(catalogModelsResponse(GEMINI_CONFIGURATION, GEMINI_CATALOG_MODELS));
    });

    const currentRow = await screen.findByRole("radio", { name: /gemini-2\.5-pro/ });
    await waitFor(() => expect(currentRow).toHaveFocus());

    const filterTabs = screen.getByRole("radiogroup", { name: /model tier filter/i });
    expect(within(filterTabs).getByRole("radio", { name: /^all$/i })).not.toHaveFocus();

    // The list is live after the repair: k moves to the previous row.
    await user.keyboard("k");
    expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/ })).toHaveFocus();
  });

  it("rejects stale checked models and never falls back to a different exact ID", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderDialog({ currentModel: "stale-model-id", onSelect });

    const confirm = await screen.findByRole("button", { name: /confirm/i });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(onSelect).not.toHaveBeenCalledWith("stale-model-id");
  });
});

describe("ModelSelectDialog transport model policies", () => {
  it("shows the honest catalog-unavailable reason for local transports", async () => {
    const localConfiguration: ClientConfigurationSummary = {
      configurationId: "ollama-loopback",
      revision: 2,
      status: "supported",
      transportFamily: "local-http",
      productId: "ollama",
      endpoint: "http://127.0.0.1:11434",
      authentication: "none",
      selectedModelId: "qwen2.5-coder:7b",
      notices: [],
      availableActions: ["inspect", "select", "test", "update", "delete"],
    };
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(skippedModelsResponse(localConfiguration));
    renderDialog({
      configuration: localConfiguration,
      getConfigurationModels,
      currentModel: "qwen2.5-coder:7b",
    });

    expect(await screen.findByText(CATALOG_SKIPPED_REASON)).toBeInTheDocument();
    expect(screen.getByText(/ollama/i)).toBeInTheDocument();
    expect(screen.getByText("No models available")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /qwen2\.5-coder/ })).not.toBeInTheDocument();
    expect(getConfigurationModels).toHaveBeenCalledWith("ollama-loopback");
  });
});
