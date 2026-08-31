import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
  ModelInfo,
} from "@diffgazer/core/schemas/config";
import {
  GEMINI_CONFIGURATION,
  OPENCODE_ZEN_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModelSelectDialog } from "./dialog";

const CHECKED_AT = "2026-08-02T12:00:00.000Z";
const CATALOG_EMPTY_MODELS_REASON =
  "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.";

function catalogModel(id: string, tier: ModelInfo["tier"] = "paid"): ModelInfo {
  return { id, name: id, description: "128K context", tier };
}

function catalogModelsResponse(
  configuration: ClientConfigurationSummary,
  models: ModelInfo[],
  source: "snapshot" | "provider-live" = "snapshot",
): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models,
    checkedAt: CHECKED_AT,
    source,
    cached: false,
  };
}

function skippedModelsResponse(
  configuration: ClientConfigurationSummary,
  reason: string = CATALOG_EMPTY_MODELS_REASON,
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

const GEMINI_CATALOG_MODELS = [catalogModel("gemini-2.5-flash"), catalogModel("gemini-2.5-pro")];

// Discovery returns the union of both pools, each row labelled with the pools
// that serve it, so a Go-only id reaches a zen-bound configuration's list.
const OPENCODE_ZEN_MODELS: ModelInfo[] = [
  { ...catalogModel("deepseek-v4-flash"), endpointProfileIds: ["zen", "go"] },
  { ...catalogModel("claude-opus-5"), endpointProfileIds: ["zen"] },
  { ...catalogModel("qwen3.7-max"), endpointProfileIds: ["go"] },
];

interface RenderOptions {
  configuration?: ClientConfigurationSummary;
  currentModel?: string | null;
  isSaving?: boolean;
  /** Flip isSaving to true when a selection is confirmed, like the page container does. */
  saveOnSelect?: boolean;
  onSelect?: (modelId: string, endpoint?: string) => void;
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
  let setConfiguration: ((configuration: ClientConfigurationSummary) => void) | undefined;
  // The harness keeps the dialog mounted across open toggles, unlike the page
  // container, so reopening here exercises the dialog's own on-open resets.
  let setDialogOpen: ((open: boolean) => void) | undefined;

  function DialogHarness() {
    const [open, setOpen] = useState(true);
    setDialogOpen = setOpen;
    const [isSaving, setIsSaving] = useState(options.isSaving ?? false);
    const [liveConfiguration, setLiveConfiguration] = useState(configuration);
    setSaving = setIsSaving;
    setConfiguration = setLiveConfiguration;

    const handleOpenChange = (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange(nextOpen);
    };

    const handleSelect = (modelId: string, endpoint?: string) => {
      onSelect(modelId, endpoint);
      if (options.saveOnSelect) setIsSaving(true);
    };

    return (
      <ModelSelectDialog
        open={open}
        onOpenChange={handleOpenChange}
        configuration={liveConfiguration}
        currentModel={currentModel}
        isSaving={isSaving}
        onSelect={handleSelect}
      />
    );
  }

  render(<DialogHarness />, { wrapper });
  return {
    getConfigurationModels,
    onSelect,
    onOpenChange,
    finishSave: () => setSaving?.(false),
    // Two commits: batching close and open into one would hide the transition
    // the dialog resets on.
    reopen: () => {
      act(() => setDialogOpen?.(false));
      act(() => setDialogOpen?.(true));
    },
    updateConfiguration: (next: ClientConfigurationSummary) => setConfiguration?.(next),
  };
}

describe("ModelSelectDialog configuration-bound discovery", () => {
  it("keeps the footer actions accessible alongside the key legend", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: /confirm/i })).toBeEnabled();
  });

  it("renders the model list as its own layout region inside the dialog", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });

    // The list is the region that scrolls inside a fixed-height panel. Whether
    // it actually scrolls is layout, not jsdom; the Dialog primitive's own test
    // owns the stable-height class.
    expect(dialog.querySelector('[data-layout-region="model-list"]')).toBeInstanceOf(HTMLElement);
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

  it("lists every catalog candidate model with the count and the bundled-catalog label", async () => {
    renderDialog();

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/ })).toBeInTheDocument(),
    );
    const modelList = screen.getByRole("radiogroup", { name: /available models/i });
    expect(within(modelList).getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText(/2 models/)).toBeInTheDocument();
    // The snapshot tier's fetchedAt is stamped at read time, so a checked date
    // over bundled data would be fabricated; the label names the data instead.
    expect(screen.getByText(/bundled catalog/i)).toBeInTheDocument();
    expect(screen.queryByText(/checked/i)).not.toBeInTheDocument();
    // No amber discovery strip on a passed catalog response.
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText(/using cached catalog data/i)).not.toBeInTheDocument();
  });

  it("keeps the checked date for a live provider list", async () => {
    renderDialog({
      getConfigurationModels: vi
        .fn<BoundApi["getConfigurationModels"]>()
        .mockResolvedValue(
          catalogModelsResponse(GEMINI_CONFIGURATION, GEMINI_CATALOG_MODELS, "provider-live"),
        ),
    });

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /gemini-2\.5-flash/ })).toBeInTheDocument(),
    );
    expect(screen.getByText(/checked/i)).toBeInTheDocument();
    expect(screen.queryByText(/bundled catalog/i)).not.toBeInTheDocument();
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
    expect(screen.getByRole("status")).toHaveTextContent("No models match the current filters.");
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

    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash", undefined);
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

  it("keeps the loaded list rendered with the selection while a save is in flight", async () => {
    const user = userEvent.setup();
    renderDialog({ currentModel: "gemini-2.5-flash", saveOnSelect: true });

    const dialog = await screen.findByRole("dialog");
    const currentRow = await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    await waitFor(() => expect(currentRow).toHaveFocus());

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /^saving/i })).toBeDisabled(),
    );

    // Progress lives on the [Confirm] button; the discovered list never blanks
    // to a spinner, the checked selection stays visible, and the focused row
    // keeps DOM focus for the whole saving window.
    const modelList = within(dialog).getByRole("radiogroup", { name: /available models/i });
    expect(within(modelList).getAllByRole("radio")).toHaveLength(2);
    expect(currentRow).toBeChecked();
    expect(currentRow).toHaveFocus();
    expect(within(dialog).queryByText(/loading models/i)).not.toBeInTheDocument();
  });

  it("keeps keys quiet while saving and returns focus to the model row when saving fails", async () => {
    const user = userEvent.setup();
    const { finishSave } = renderDialog({ currentModel: "gemini-2.5-flash", saveOnSelect: true });

    const dialog = await screen.findByRole("dialog");
    const currentRow = await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    await waitFor(() => expect(currentRow).toHaveFocus());

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /^saving/i })).toBeDisabled(),
    );

    // f must not cycle the tier filter, / must not move the zone into the
    // disabled search box, and j must not move the disabled list's highlight
    // while the save window is open.
    await user.keyboard("f");
    await user.keyboard("/");
    await user.keyboard("j");
    expect(within(dialog).getByRole("radio", { name: /gemini-2\.5-flash/ })).toHaveFocus();

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

  it("keeps the loaded list rendered while a configuration revision bump refetches discovery", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValueOnce(catalogModelsResponse(GEMINI_CONFIGURATION, GEMINI_CATALOG_MODELS))
      // The refetch under the bumped fingerprint never settles: the list must
      // stay up from the previous discovery, not blank to the spinner.
      .mockReturnValue(new Promise<ConfigurationModelsResponse>(() => {}));
    const { updateConfiguration } = renderDialog({
      currentModel: "gemini-2.5-flash",
      getConfigurationModels,
    });

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });

    // A saved selection bumps the row's revision/selectedModelId, which rotates
    // the discovery query key while the dialog is still open.
    act(() =>
      updateConfiguration({
        ...GEMINI_CONFIGURATION,
        revision: GEMINI_CONFIGURATION.revision + 1,
        selectedModelId: "gemini-2.5-pro",
      }),
    );

    await waitFor(() => expect(getConfigurationModels).toHaveBeenCalledTimes(2));
    const modelList = within(dialog).getByRole("radiogroup", { name: /available models/i });
    expect(within(modelList).getAllByRole("radio")).toHaveLength(2);
    expect(within(dialog).queryByText(/loading models/i)).not.toBeInTheDocument();
  });
});

describe("ModelSelectDialog search escape staging", () => {
  it("clears the query on the first Esc and releases the empty-query press to the dialog cancel", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });
    const search = screen.getByRole("searchbox", { name: "Search models" });
    await user.click(search);
    await user.keyboard("flash");
    expect(search).toHaveValue("flash");

    // fireEvent retained: the assertion is the keydown's defaultPrevented verdict -- what
    // decides whether the native <dialog> cancel may fire -- which userEvent does not expose.
    const clearingPressPropagates = fireEvent.keyDown(search, { key: "Escape" });
    expect(clearingPressPropagates).toBe(false);
    expect(search).toHaveValue("");
    expect(onOpenChange).not.toHaveBeenCalled();

    // fireEvent retained: same defaultPrevented verdict for the empty-query press.
    const emptyPressPropagates = fireEvent.keyDown(search, { key: "Escape" });
    expect(emptyPressPropagates).toBe(true);

    // The browser answers the unprevented Escape with the native cancel.
    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears the query from the keyboard via ArrowRight to the clear button and Enter", async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });
    const search = screen.getByRole("searchbox", { name: "Search models" });
    await user.click(search);
    await user.keyboard("flash");

    await user.keyboard("{ArrowRight}");
    const clearButton = screen.getByRole("button", { name: "Clear search" });
    expect(clearButton).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
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
    expect(await screen.findAllByText(CATALOG_EMPTY_MODELS_REASON)).toHaveLength(1);
    expect(
      screen
        .getAllByRole("status")
        .filter((region) => region.textContent?.includes(CATALOG_EMPTY_MODELS_REASON)),
    ).toHaveLength(1);
    expect(screen.getByText("No models available")).toBeInTheDocument();
    expect(screen.getByText(/checked/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(getConfigurationModels).toHaveBeenCalledTimes(2));
  });

  it("keeps the Retry button in the vertical navigation chain while the warning is shown", async () => {
    const user = userEvent.setup();
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(skippedModelsResponse(GEMINI_CONFIGURATION));
    renderDialog({ getConfigurationModels });

    const retryButton = await screen.findByRole("button", { name: "Retry" });

    await user.keyboard("/");
    const search = screen.getByRole("searchbox", { name: "Search models" });
    await waitFor(() => expect(search).toHaveFocus());

    // Down from search stops on Retry before falling through to the footer.
    await user.keyboard("{ArrowDown}");
    expect(retryButton).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    // Up from the footer takes the same path back through Retry to search.
    await user.keyboard("{ArrowUp}");
    expect(retryButton).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(search).toHaveFocus();

    // Enter on the focused Retry runs discovery again.
    await user.keyboard("{ArrowDown}");
    expect(retryButton).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(getConfigurationModels).toHaveBeenCalledTimes(2));
  });

  it("hands focus to the merged filter row when a retried discovery succeeds", async () => {
    const user = userEvent.setup();
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValueOnce(skippedModelsResponse(GEMINI_CONFIGURATION))
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION, GEMINI_CATALOG_MODELS));
    renderDialog({ getConfigurationModels });

    const retryButton = await screen.findByRole("button", { name: "Retry" });
    await user.keyboard("/");
    await waitFor(() =>
      expect(screen.getByRole("searchbox", { name: "Search models" })).toHaveFocus(),
    );
    await user.keyboard("{ArrowDown}");
    expect(retryButton).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(getConfigurationModels).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument(),
    );

    // The callout unmounts under the focused button, so focus moves to the first
    // enabled zone above it instead of dropping to the body: the filter row, at
    // the segment its index sits on.
    await waitFor(() => expect(screen.getByRole("radio", { name: "all" })).toHaveFocus());
  });

  it("retries discovery from r outside the search box and teaches the key on the Retry button", async () => {
    const user = userEvent.setup();
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(skippedModelsResponse(GEMINI_CONFIGURATION));
    renderDialog({ getConfigurationModels });

    // The visible Retry button teaches r (aria-keyshortcuts), the same rule that
    // keeps Enter/Esc out of the legend — so the footer legend stays the list
    // keys only and shares one row with the actions.
    const retryButton = await screen.findByRole("button", { name: "Retry" });
    expect(retryButton).toHaveAttribute("aria-keyshortcuts", "r");
    const legend = screen.getByText("Navigate").closest('[data-slot="overlay-hints"]');
    expect(within(legend as HTMLElement).queryByText("Retry")).not.toBeInTheDocument();

    await user.keyboard("r");
    await waitFor(() => expect(getConfigurationModels).toHaveBeenCalledTimes(2));

    // The search box keeps the letter for typing.
    await user.keyboard("/");
    const search = screen.getByRole("searchbox", { name: "Search models" });
    await waitFor(() => expect(search).toHaveFocus());
    await user.keyboard("r");
    expect(search).toHaveValue("r");
    expect(getConfigurationModels).toHaveBeenCalledTimes(2);
  });

  it("keeps r out of the legend and quiet while discovery has nothing to retry", async () => {
    const user = userEvent.setup();
    const { getConfigurationModels } = renderDialog();

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("radio", { name: /gemini-2\.5-flash/ });
    const legend = within(dialog).getByText("Navigate").closest('[data-slot="overlay-hints"]');
    expect(within(legend as HTMLElement).queryByText("Retry")).not.toBeInTheDocument();

    await user.keyboard("r");
    expect(getConfigurationModels).toHaveBeenCalledTimes(1);
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

    // j/k stay bound as the Help table's vim aliases; pressing them while the
    // list does not exist yet must not consume the initial-focus window.
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

    expect(onSelect).toHaveBeenCalledWith("gemini-2.5-flash", undefined);
    expect(onSelect).not.toHaveBeenCalledWith("stale-model-id");
  });

  // A configuration saved before the capability filter existed keeps working;
  // the dialog says so instead of leaving the missing row unexplained.
  it("explains a saved model the review-capable list no longer offers", async () => {
    renderDialog({ currentModel: "retired-model-id" });

    expect(await screen.findByText(/retired-model-id stays configured/)).toBeInTheDocument();
  });

  it("says nothing about the saved model while it is still offered", async () => {
    renderDialog({ currentModel: "gemini-2.5-flash" });

    await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });
    expect(screen.queryByText(/stays configured/)).not.toBeInTheDocument();
  });
});

describe("ModelSelectDialog endpoint pools", () => {
  const ZEN_ENDPOINT = "https://opencode.ai/zen/v1";
  const GO_ENDPOINT = "https://opencode.ai/zen/go/v1";

  function renderPoolDialog(options: RenderOptions = {}) {
    return renderDialog({
      configuration: OPENCODE_ZEN_CONFIGURATION,
      currentModel: "deepseek-v4-flash",
      getConfigurationModels: vi
        .fn<BoundApi["getConfigurationModels"]>()
        .mockResolvedValue(catalogModelsResponse(OPENCODE_ZEN_CONFIGURATION, OPENCODE_ZEN_MODELS)),
      ...options,
    });
  }

  // Scoped to the model list: the pool and tier rows are radiogroups too.
  function listedModelIds() {
    const list = screen.getByRole("radiogroup", { name: "Available models" });
    return within(list)
      .getAllByRole("radio")
      .map((row) => row.getAttribute("data-value"));
  }

  function poolTab(name: string) {
    return within(screen.getByRole("radiogroup", { name: "Billing pool" })).getByRole("radio", {
      name,
    });
  }

  it("offers the pool tabs and tier filters in one Model filters toolbar with the bound tab checked", async () => {
    renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    const heading = screen.getByRole("heading", { name: "Select Model" });
    expect(heading.closest('[data-slot="dialog-header"]')).toHaveTextContent("OpenCode · 3 models");

    const toolbar = screen.getByRole("toolbar", { name: "Model filters" });
    expect(within(toolbar).getAllByRole("radiogroup")).toHaveLength(2);
    expect(within(toolbar).getByRole("radiogroup", { name: "Billing pool" })).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("radiogroup", { name: "Model tier filter" }),
    ).toBeInTheDocument();
    expect(poolTab("OpenCode Zen")).toBeChecked();
    expect(poolTab("OpenCode Go")).not.toBeChecked();
  });

  it("leaves a single-pool product without a pool selector or pool copy", async () => {
    renderDialog();

    await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });
    const heading = screen.getByRole("heading", { name: "Select Model" });
    expect(heading.closest('[data-slot="dialog-header"]')).toHaveTextContent(
      "Google Gemini · 2 models · bundled catalog",
    );

    const toolbar = screen.getByRole("toolbar", { name: "Model filters" });
    const groups = within(toolbar).getAllByRole("radiogroup");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toBe(within(toolbar).getByRole("radiogroup", { name: "Model tier filter" }));
    expect(screen.queryByRole("radiogroup", { name: "Billing pool" })).not.toBeInTheDocument();
    // No pool anywhere in the frame: no group, no pool copy, no footer hint.
    expect(within(screen.getByRole("dialog")).queryByText(/\b(Zen|Go)\b/)).not.toBeInTheDocument();
    expect(screen.queryByText("Pool")).not.toBeInTheDocument();
  });

  it("renders no pool badge on any picker row", async () => {
    const user = userEvent.setup();
    renderPoolDialog();

    const poolBadges = () =>
      within(screen.getByRole("radiogroup", { name: "Available models" })).queryByText(
        /^(Zen|Go)$/,
      );

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    // The active tab names the pool, so no row repeats it under either tab.
    expect(listedModelIds()).toEqual(["deepseek-v4-flash", "claude-opus-5"]);
    expect(poolBadges()).not.toBeInTheDocument();

    await user.keyboard("p");

    expect(listedModelIds()).toEqual(["deepseek-v4-flash", "qwen3.7-max"]);
    expect(poolBadges()).not.toBeInTheDocument();
  });

  it("switching to the Go tab lists only the rows Go serves and keeps the shared row", async () => {
    const user = userEvent.setup();
    renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    expect(listedModelIds()).toEqual(["deepseek-v4-flash", "claude-opus-5"]);

    await user.keyboard("p");

    // The shared row appears under both tabs; the exclusive rows swap, so every
    // id of the union response is reachable through one tab or the other.
    expect(poolTab("OpenCode Go")).toBeChecked();
    expect(listedModelIds()).toEqual(["deepseek-v4-flash", "qwen3.7-max"]);

    await user.keyboard("p");
    expect(listedModelIds()).toEqual(["deepseek-v4-flash", "claude-opus-5"]);
  });

  it("lists an unknown-membership row under both tabs", async () => {
    const user = userEvent.setup();
    renderPoolDialog({
      getConfigurationModels: vi
        .fn<BoundApi["getConfigurationModels"]>()
        .mockResolvedValue(
          catalogModelsResponse(OPENCODE_ZEN_CONFIGURATION, [
            ...OPENCODE_ZEN_MODELS,
            catalogModel("glm-5.3"),
          ]),
        ),
    });

    await screen.findByRole("radio", { name: /glm-5\.3/ });
    expect(listedModelIds()).toContain("glm-5.3");

    await user.keyboard("p");

    expect(listedModelIds()).toContain("glm-5.3");
  });

  it("reopens on the bound tab after a discarded tab change", async () => {
    const user = userEvent.setup();
    const { reopen } = renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    await user.keyboard("p");
    reopen();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    expect(poolTab("OpenCode Zen")).toBeChecked();
    expect(listedModelIds()).toEqual(["deepseek-v4-flash", "claude-opus-5"]);
    expect(screen.queryByText("Saving moves billing to OpenCode Go.")).not.toBeInTheDocument();
  });

  it("hides a Zen-only checked row on the Go tab and names the tab that serves it", async () => {
    const user = userEvent.setup();
    renderPoolDialog({ currentModel: "claude-opus-5" });

    await screen.findByRole("radio", { name: /claude-opus-5/ });
    await user.keyboard("p");

    expect(listedModelIds()).toEqual(["deepseek-v4-flash", "qwen3.7-max"]);
    expect(screen.getByText("claude-opus-5 is on the Zen tab.")).toBeInTheDocument();
  });

  it("confirms only the visible selection while the checked row is hidden", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPoolDialog({ currentModel: "claude-opus-5" });

    const checkedRow = await screen.findByRole("radio", { name: /claude-opus-5/ });
    await waitFor(() => expect(checkedRow).toHaveFocus());

    await user.keyboard("p");

    // The hidden row keeps its check, but the confirm resolves among the visible
    // rows alone, so the save can only be what the user can see.
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /deepseek-v4-flash/ })).toHaveFocus(),
    );
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("deepseek-v4-flash", GO_ENDPOINT);
  });

  it("restores the check when its tab returns", async () => {
    const user = userEvent.setup();
    renderPoolDialog({ currentModel: "claude-opus-5" });

    await screen.findByRole("radio", { name: /claude-opus-5/ });
    await user.keyboard("p");
    expect(screen.queryByRole("radio", { name: /claude-opus-5/ })).not.toBeInTheDocument();

    await user.keyboard("p");

    expect(screen.getByRole("radio", { name: /claude-opus-5/ })).toBeChecked();
    expect(screen.queryByText("claude-opus-5 is on the Zen tab.")).not.toBeInTheDocument();
  });

  it("disables Confirm and says no models match when the active tab is emptied", async () => {
    const user = userEvent.setup();
    renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    // Pool, tier, and search compose: paid keeps every row, but the Go-only row
    // the query names is not one the Zen tab serves.
    const tierGroup = screen.getByRole("radiogroup", { name: "Model tier filter" });
    await user.click(within(tierGroup).getByRole("radio", { name: "paid" }));
    await user.click(screen.getByRole("searchbox", { name: "Search models" }));
    await user.keyboard("qwen");

    await waitFor(() =>
      expect(
        screen.queryByRole("radiogroup", { name: "Available models" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("No models match the current filters.");
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
  });

  it("confirms a shared row on the active tab and a zen-only row on its own pool", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    await user.keyboard("p");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenLastCalledWith("deepseek-v4-flash", GO_ENDPOINT);

    await user.keyboard("p");
    await user.click(screen.getByRole("radio", { name: /claude-opus-5/ }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    // Zen is the bound endpoint, so the row needs no pool move.
    expect(onSelect).toHaveBeenLastCalledWith("claude-opus-5", undefined);
  });

  it("shows the billing-move note exactly while the sibling tab is active", async () => {
    const user = userEvent.setup();
    renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    expect(screen.queryByText("Saving moves billing to OpenCode Go.")).not.toBeInTheDocument();

    await user.keyboard("p");

    // The tab alone states the consequence, before any row gesture.
    expect(screen.getByText("Saving moves billing to OpenCode Go.")).toBeInTheDocument();

    await user.keyboard("p");
    expect(screen.queryByText("Saving moves billing to OpenCode Go.")).not.toBeInTheDocument();
  });

  it("reaches a Go-only row under the Go tab and posts its endpoint", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    await user.keyboard("p");

    await user.click(screen.getByRole("radio", { name: /qwen3\.7-max/ }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenLastCalledWith("qwen3.7-max", GO_ENDPOINT);
  });

  it("stands p down inside the search box so the letter can be typed", async () => {
    const user = userEvent.setup();
    renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    const search = screen.getByRole("searchbox", { name: "Search models" });
    const before = listedModelIds();

    await user.click(search);
    await user.keyboard("p");

    expect(search).toHaveValue("p");
    expect(poolTab("OpenCode Zen")).toBeChecked();
    expect(listedModelIds()).toEqual(before);
  });

  it("walks one toolbar row between search and the list, moving focus across all five segments without selecting", async () => {
    const user = userEvent.setup();
    renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    const zenTab = poolTab("OpenCode Zen");
    const goTab = poolTab("OpenCode Go");
    const tierGroup = screen.getByRole("radiogroup", { name: "Model tier filter" });
    const allTab = within(tierGroup).getByRole("radio", { name: "all" });
    const freeTab = within(tierGroup).getByRole("radio", { name: "free" });
    const paidTab = within(tierGroup).getByRole("radio", { name: "paid" });
    const search = screen.getByRole("searchbox", { name: "Search models" });

    await user.click(search);
    await user.keyboard("{ArrowDown}");
    expect(zenTab).toHaveFocus();

    // The row's outer edges do not wrap: the vertical keys own the exits.
    await user.keyboard("{ArrowLeft}");
    expect(zenTab).toHaveFocus();

    // Manual activation across both groups: the horizontal keys move focus and
    // leave every selection where it was.
    for (const segment of [goTab, allTab, freeTab, paidTab]) {
      await user.keyboard("{ArrowRight}");
      expect(segment).toHaveFocus();
      expect(zenTab).toBeChecked();
      expect(allTab).toBeChecked();
    }

    await user.keyboard("{ArrowRight}");
    expect(paidTab).toHaveFocus();

    await user.keyboard(" ");
    expect(paidTab).toBeChecked();

    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(goTab).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(goTab).toBeChecked();

    // j/k are the vim aliases of the vertical exits: the search box above, the
    // list below.
    await user.keyboard("k");
    expect(search).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(goTab).toHaveFocus();

    await user.keyboard("j");
    expect(screen.getByRole("radio", { name: /deepseek-v4-flash/ })).toHaveFocus();
  });

  it("keeps the endpoint bound when a single-pool product confirms a row", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderDialog();

    await screen.findByRole("radio", { name: /gemini-2\.5-pro/ });
    await user.click(screen.getByRole("radio", { name: /gemini-2\.5-pro/ }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenLastCalledWith("gemini-2.5-pro", undefined);
  });

  it("keeps the pool row accessible alongside the tier row", async () => {
    renderPoolDialog();

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    // Colour contrast is a token contract jsdom cannot compute.
    const results = await axeCore.run(screen.getByRole("dialog"), {
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations).toEqual([]);
  });

  it("defaults to the Go tab on a Go-bound configuration", async () => {
    const user = userEvent.setup();
    const goConfiguration = { ...OPENCODE_ZEN_CONFIGURATION, endpoint: GO_ENDPOINT };
    const { onSelect } = renderPoolDialog({
      configuration: goConfiguration,
      getConfigurationModels: vi
        .fn<BoundApi["getConfigurationModels"]>()
        .mockResolvedValue(catalogModelsResponse(goConfiguration, OPENCODE_ZEN_MODELS)),
    });

    await screen.findByRole("radio", { name: /deepseek-v4-flash/ });
    expect(poolTab("OpenCode Go")).toBeChecked();
    expect(listedModelIds()).toEqual(["deepseek-v4-flash", "qwen3.7-max"]);
    expect(screen.queryByText("Saving moves billing to OpenCode Zen.")).not.toBeInTheDocument();

    await user.keyboard("p");
    expect(poolTab("OpenCode Zen")).toBeChecked();
    expect(screen.getByText("Saving moves billing to OpenCode Zen.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenLastCalledWith("deepseek-v4-flash", ZEN_ENDPOINT);
  });
});
