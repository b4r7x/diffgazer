import {
  getProviderActionLayout,
  getProviderRowControls,
  getProviderRowId,
  isProviderControlDisabled,
  type ProviderActionLayout,
  type ProviderListRow,
  type ProviderRowControl,
} from "@diffgazer/core/providers";
import {
  buildProviderRows,
  configurationStatus,
  ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProviderList } from "@/features/providers/components/list";
import { HeaderChromeHarness } from "@/testing/header-chrome";
import { filterProviders, PROVIDER_FILTERS, type ProviderFilter } from "../lib/filter";
import { useProvidersKeyboard } from "./use-keyboard";

const ROWS: ProviderListRow[] = filterProviders(buildProviderRows(), "all");
const GEMINI_ROW = ROWS.find((row) => row.configuration?.configurationId === "gemini-primary");
const ZAI_ROW = ROWS.find((row) => row.configuration?.configurationId === "zai-primary");
if (!GEMINI_ROW || !ZAI_ROW) throw new Error("Missing fixture rows");

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

/** Mirrors the page layer: the same layout drives the buttons and the keyboard zone. */
function ActionButtons({
  layout,
  isPending = false,
  getButtonProps,
}: {
  layout: ProviderActionLayout;
  isPending?: boolean;
  getButtonProps: ReturnType<typeof useProvidersKeyboard>["getActionButtonProps"];
}) {
  return (
    <>
      {getProviderRowControls(layout).map((control, index) => (
        <button
          key={control.id}
          type="button"
          {...getButtonProps(index)}
          disabled={isProviderControlDisabled(control, isPending)}
        >
          {control.label}
        </button>
      ))}
    </>
  );
}

function Subject({
  filteredProviders = ROWS,
  onSelectedId = vi.fn(),
  listReady = true,
  isPending = false,
  hasNotice = false,
  dialogOpen = false,
  activatesOnSelect = false,
  runControl = vi.fn(),
  hasConsentLink = false,
}: {
  filteredProviders?: ProviderListRow[];
  onSelectedId?: (id: string | null) => void;
  listReady?: boolean;
  isPending?: boolean;
  hasNotice?: boolean;
  dialogOpen?: boolean;
  /** Mirrors the mutation: selecting the configuration makes it the active one, rebuilding the row. */
  activatesOnSelect?: boolean;
  runControl?: (control: ProviderRowControl) => void;
  hasConsentLink?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    getProviderRowId(GEMINI_ROW as ProviderListRow),
  );
  const [activeConfigurationId, setActiveConfigurationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const noticeActionRef = useRef<HTMLButtonElement>(null);
  const selectedRow =
    filteredProviders.find((row) => getProviderRowId(row) === selectedId) ??
    (GEMINI_ROW as ProviderListRow);
  const layout = getProviderActionLayout(selectedRow, activeConfigurationId);
  const keyboard = useProvidersKeyboard({
    layout,
    hasSelection: selectedRow !== null,
    listRowIds: (filteredProviders as ProviderListRow[]).map(getProviderRowId),
    listReady,
    filter: "all",
    setSelectedId: (id) => {
      onSelectedId(id);
      if (id) setSelectedId(id);
    },
    dialogOpen,
    overflowMenuOpen: false,
    isPending,
    hasNotice,
    inputRef,
    listContainerRef,
    noticeActionRef,
    runControl: (control) => {
      if (activatesOnSelect && control.id === "selectConfiguration") {
        setActiveConfigurationId(selectedRow.configuration?.configurationId ?? null);
      }
      runControl(control);
    },
    reviewConsent: null,
  });

  return (
    <>
      {hasNotice ? (
        <button type="button" ref={noticeActionRef} onFocus={keyboard.handleNoticeFocus}>
          Retry
        </button>
      ) : null}
      <input
        ref={inputRef}
        aria-label="Search providers"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onFocus={keyboard.handleSearchFocus}
      />
      {PROVIDER_FILTERS.map((filter, index) => (
        <button
          key={filter}
          type="button"
          onKeyDown={keyboard.handleFilterKeyDown}
          onFocus={() => keyboard.handleFilterIndexChange(index)}
          {...keyboard.getFilterButtonProps(index)}
        >
          {filter}
        </button>
      ))}
      {/* Mirrors ProviderList: the list's own keydown claims the accelerators before typeahead. */}
      <div
        ref={listContainerRef}
        tabIndex={0}
        role="listbox"
        aria-label="Providers"
        onKeyDown={keyboard.handleListKeyDown}
      >
        {selectedId}
      </div>
      {/* Mirrors details.tsx: the focusable ScrollArea viewport wraps the
          tabIndex={-1} focus park and the action row, so the cycle sees the
          same nesting production renders. The park has no role and no
          accessible name in production, so it is reached by test id. */}
      {/* biome-ignore lint/a11y/useSemanticElements: mirrors the region div ScrollArea renders, which owns the pane ref. */}
      <div
        ref={keyboard.detailsPaneRef}
        role="region"
        aria-label="Provider details content"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the tab stop is the behavior under test — ScrollArea's keyboard-scrollable region carries tabIndex 0.
        tabIndex={0}
      >
        <div ref={keyboard.focusFallbackRef} tabIndex={-1} data-testid="details-focus-park">
          <div ref={keyboard.actionRowRef}>
            <ActionButtons
              layout={layout}
              isPending={isPending}
              getButtonProps={keyboard.getActionButtonProps}
            />
          </div>
          {hasConsentLink ? (
            <button type="button" ref={keyboard.consentLinkRef}>
              Review the provider data notice
            </button>
          ) : null}
        </div>
      </div>
      {/* Mirrors the page layer's parked footer hint, which names this zone. */}
      <p>{`chrome return: ${keyboard.chromeReturnZone ?? "none"}`}</p>
      <p>{`zone: ${keyboard.focusZone}`}</p>
    </>
  );
}

function ProviderListSubject({
  rows = ROWS,
  initialSelectedId = getProviderRowId(GEMINI_ROW as ProviderListRow),
  onFilter = vi.fn(),
  runControl = vi.fn(),
}: {
  rows?: ProviderListRow[];
  initialSelectedId?: string;
  onFilter?: (filter: ProviderFilter) => void;
  runControl?: (control: ProviderRowControl) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const noticeActionRef = useRef<HTMLButtonElement>(null);
  const selectedRow =
    rows.find((row) => getProviderRowId(row) === selectedId) ?? (GEMINI_ROW as ProviderListRow);
  const layout = getProviderActionLayout(selectedRow, null);
  const keyboard = useProvidersKeyboard({
    layout,
    hasSelection: selectedRow !== null,
    listRowIds: rows.map(getProviderRowId),
    listReady: true,
    filter,
    setSelectedId: setSelectedId,
    dialogOpen: false,
    overflowMenuOpen: false,
    isPending: false,
    hasNotice: false,
    inputRef,
    listContainerRef,
    noticeActionRef,
    runControl,
    reviewConsent: null,
  });

  return (
    <>
      <ProviderList
        ref={listContainerRef}
        providers={rows}
        unrecognized={[]}
        selectedId={selectedId}
        highlighted={selectedId}
        onSelect={setSelectedId}
        onHighlightChange={setSelectedId}
        filter={filter}
        onFilterChange={(nextFilter) => {
          setFilter(nextFilter);
          onFilter(nextFilter);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isFocused={keyboard.focusZone === "list"}
        inputRef={inputRef}
        onSearchFocus={keyboard.handleSearchFocus}
        onSearchEscape={keyboard.handleSearchEscape}
        focusedFilterIndex={keyboard.filterIndex}
        onFilterIndexChange={keyboard.handleFilterIndexChange}
        onFilterKeyDown={keyboard.handleFilterKeyDown}
        getFilterButtonProps={keyboard.getFilterButtonProps}
        onListKeyDown={keyboard.handleListKeyDown}
        onBoundaryReached={keyboard.handleListBoundary}
      />
      <ActionButtons layout={layout} getButtonProps={keyboard.getActionButtonProps} />
    </>
  );
}

describe("useProvidersKeyboard", () => {
  it("focuses the provider list after it becomes ready", async () => {
    const { rerender } = render(
      <KeyboardProvider>
        <Subject listReady={false} />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("listbox", { name: "Providers" })).not.toHaveFocus();

    rerender(
      <KeyboardProvider>
        <Subject listReady />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus());
  });

  it("moves real focus from the provider list to the first enabled action and back", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject />
      </KeyboardProvider>,
    );

    const providerList = screen.getByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(providerList).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(providerList).toHaveFocus();
  });

  it("disables an action the row cannot run", () => {
    // The metadata schema pins supported configurations to the full action contract, so a ready
    // row missing "select" is built directly to exercise the reason-disabled path.
    const readyRow = ROWS.find((row) => row.configuration?.configurationId === "zai-primary");
    if (!readyRow) throw new Error("Missing zai fixture");
    const noSelectRow: ProviderListRow = {
      ...readyRow,
      actions: ["inspect", "test", "update", "delete"],
    };
    const rows = ROWS.map((row) => (row === readyRow ? noSelectRow : row));

    render(
      <KeyboardProvider>
        <ProviderListSubject rows={rows} initialSelectedId={getProviderRowId(noSelectRow)} />
      </KeyboardProvider>,
    );

    const select = screen.getByRole("button", { name: "Select configuration" });
    expect(select).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update configuration" })).not.toBeDisabled();
  });

  it("keeps every applicable action enabled for a ready provider", () => {
    render(
      <KeyboardProvider>
        <ProviderListSubject />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("button", { name: "Change model" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "More" })).not.toBeDisabled();
  });

  it("hands the keyboard zone and the roving tab target to a clicked filter button", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <ProviderListSubject />
      </KeyboardProvider>,
    );

    const listbox = screen.getByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());

    const configuredFilter = screen.getByRole("radio", { name: "Configured" });
    await user.click(configuredFilter);

    expect(configuredFilter).toHaveFocus();
    // The recorded filter index drives the row's roving tab target.
    expect(configuredFilter).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute("tabindex", "-1");

    // ...and the zone moved with it: ArrowDown from the filter row enters the list.
    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveFocus();
  });

  it("keeps Select configuration reachable for setup routing", async () => {
    const user = userEvent.setup();
    const runControl = vi.fn();

    render(
      <KeyboardProvider>
        <ProviderListSubject runControl={runControl} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(runControl).toHaveBeenCalledWith(expect.objectContaining({ id: "selectConfiguration" }));
  });

  it("opens the More menu from the row's last control with Enter", async () => {
    const user = userEvent.setup();
    const runControl = vi.fn();

    render(
      <KeyboardProvider>
        <ProviderListSubject runControl={runControl} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(runControl).toHaveBeenCalledWith(expect.objectContaining({ id: "more" }));
  });

  it("arrows from the action row's bottom onto the consent Review link and back", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject hasConsentLink />
      </KeyboardProvider>,
    );

    const providerList = screen.getByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(providerList).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();

    const link = screen.getByRole("button", { name: "Review the provider data notice" });
    let lastAction: Element | null = null;
    for (let i = 0; i < 8 && document.activeElement !== link; i += 1) {
      lastAction = document.activeElement;
      await user.keyboard("{ArrowDown}");
    }
    expect(link).toHaveFocus();
    expect(screen.getByText("zone: details")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(link).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(link).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(link).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(lastAction).not.toBeNull();
    expect(lastAction).toHaveFocus();
  });

  it("cycles Tab through the list, the details pane, and the action row like the TUI panes", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject />
      </KeyboardProvider>,
    );

    const providerList = screen.getByRole("listbox", { name: "Providers" });
    const detailsPane = screen.getByRole("region", { name: "Provider details content" });
    await waitFor(() => expect(providerList).toHaveFocus());

    await user.tab();
    await waitFor(() => expect(detailsPane).toHaveFocus());

    await user.tab();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus(),
    );

    await user.tab();
    await waitFor(() => expect(providerList).toHaveFocus());

    // Shift+Tab reverses the cycle; the hop from the action row back onto the
    // pane that contains it must move real focus onto the scroll viewport.
    await user.tab({ shift: true });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus(),
    );

    await user.tab({ shift: true });
    await waitFor(() => expect(detailsPane).toHaveFocus());

    await user.tab({ shift: true });
    await waitFor(() => expect(providerList).toHaveFocus());
  });

  it("stands the Tab cycle down while a mutation is pending so Tab stays native", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject isPending />
      </KeyboardProvider>,
    );

    const providerList = screen.getByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(providerList).toHaveFocus());

    // Every action button is disabled, so a claimed Tab would flip the zone to
    // "buttons" with nothing focusable and strand the list's arrows; native Tab
    // must continue into the pane's own tab stop instead.
    await user.tab();
    expect(screen.getByRole("region", { name: "Provider details content" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(providerList).toHaveFocus();
  });

  it("declines the Tab cycle outside the panes so the search box keeps native Tab", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject />
      </KeyboardProvider>,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search providers" });
    await user.click(searchInput);
    expect(searchInput).toHaveFocus();

    await user.tab();
    // Native order continues into the filter buttons; the pane cycle never grabs it.
    expect(screen.getByRole("button", { name: "all" })).toHaveFocus();
  });

  it("runs every accelerator from the list zone, Delete included", async () => {
    const user = userEvent.setup();
    const runControl = vi.fn();

    render(
      <KeyboardProvider>
        <Subject runControl={runControl} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus());
    await user.keyboard("m");
    expect(runControl).toHaveBeenLastCalledWith(expect.objectContaining({ id: "selectModel" }));
    await user.keyboard("e");
    expect(runControl).toHaveBeenLastCalledWith(expect.objectContaining({ id: "setup" }));
    await user.keyboard("v");
    expect(runControl).toHaveBeenLastCalledWith(expect.objectContaining({ id: "verify" }));
    await user.keyboard("d");
    expect(runControl).toHaveBeenLastCalledWith(expect.objectContaining({ id: "delete" }));
    expect(runControl).toHaveBeenCalledTimes(4);
  });

  it("keeps the accelerators out of the search box and quiet while an overlay owns the keys", async () => {
    const user = userEvent.setup();
    const runControl = vi.fn();

    const { rerender } = render(
      <KeyboardProvider>
        <Subject runControl={runControl} />
      </KeyboardProvider>,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search providers" });
    await user.click(searchInput);
    await user.keyboard("v");
    expect(searchInput).toHaveValue("v");
    expect(runControl).not.toHaveBeenCalled();

    rerender(
      <KeyboardProvider>
        <Subject runControl={runControl} dialogOpen />
      </KeyboardProvider>,
    );
    screen.getByRole("listbox", { name: "Providers" }).focus();
    await user.keyboard("v");
    expect(runControl).not.toHaveBeenCalled();
  });

  it("ignores an accelerator whose action the state cannot run", async () => {
    const user = userEvent.setup();
    const runControl = vi.fn();
    const rows = filterProviders(
      buildProviderRows([configurationStatus(ZAI_CONFIGURATION, "model-missing")]),
      "all",
    );
    const noModelRow = rows.find((row) => row.configuration?.configurationId === "zai-primary");
    if (!noModelRow) throw new Error("Missing zai fixture");

    render(
      <KeyboardProvider>
        <ProviderListSubject
          rows={rows}
          initialSelectedId={getProviderRowId(noModelRow)}
          runControl={runControl}
        />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("v");
    expect(runControl).not.toHaveBeenCalled();
    await user.keyboard("m");
    expect(runControl).toHaveBeenCalledWith(expect.objectContaining({ task: "select" }));
  });

  it("claims a bound accelerator while a mutation is pending without running it", async () => {
    const runControl = vi.fn();

    render(
      <KeyboardProvider>
        <Subject runControl={runControl} isPending />
      </KeyboardProvider>,
    );

    const listbox = screen.getByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());

    // fireEvent retained: the claim contract is the keydown's defaultPrevented verdict -- what
    // keeps the letter from falling through to list typeahead -- which userEvent does not expose.
    const propagates = fireEvent.keyDown(listbox, { key: "v" });
    expect(propagates).toBe(false);
    expect(runControl).not.toHaveBeenCalled();
  });

  it("cycles real focus between the notice action and the search input", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject hasNotice />
      </KeyboardProvider>,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search providers" });
    await user.click(searchInput);
    expect(searchInput).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(searchInput).toHaveFocus();
  });

  it("hands focus from search to the header Back button when no notice renders, then resumes native Tab", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search providers" });
    await user.click(searchInput);

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    // The containers-scoped Tab cycle declines on the chrome: native Tab
    // re-enters at the search input instead of jumping to the list zone.
    await user.tab();
    expect(searchInput).toHaveFocus();
    expect(screen.getByRole("listbox", { name: "Providers" })).not.toHaveFocus();
  });

  it("returns focus to the search box with ArrowDown after the hand-off", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search providers" });
    await user.click(searchInput);
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(searchInput).toHaveFocus();
  });

  it("returns focus to the notice action with ArrowDown after the hand-off", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject hasNotice />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );

    await user.click(screen.getByRole("textbox", { name: "Search providers" }));
    await user.keyboard("{ArrowUp}");
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    // The hand-off remembers the control it left, so the return skips the search
    // box the other origin would come back to.
    expect(retry).toHaveFocus();
  });

  it("falls back to the provider list when the notice vanishes while parked", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject hasNotice />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );

    await user.click(screen.getByRole("textbox", { name: "Search providers" }));
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    rerender(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject hasNotice={false} />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    // The parked hint follows the return: no Retry left to name, so the footer
    // advertises the zone the arrow actually lands in.
    expect(screen.getByText("chrome return: list")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");

    await waitFor(() => expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus());
  });

  it("ignores ArrowDown on the Back button when nothing handed off", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );

    const backButton = screen.getByRole("button", { name: "Back" });
    backButton.focus();

    await user.keyboard("{ArrowDown}");

    expect(backButton).toHaveFocus();
  });

  it("keeps ArrowUp native in the search input until the caret sits at the start", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );

    const searchInput = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Search providers",
    });
    await user.click(searchInput);
    await user.keyboard("abc");

    await user.keyboard("{ArrowUp}");

    expect(searchInput).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back" })).not.toHaveFocus();

    searchInput.setSelectionRange(0, 0);
    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
  });

  it("keeps Escape leaving the page from the Back button after the search hand-off", async () => {
    const user = userEvent.setup();
    mockNavigate.mockClear();

    render(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search providers" });
    await user.click(searchInput);

    // In the input itself Escape keeps its move to the filter row.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "all" })).toHaveFocus();
    expect(mockNavigate).not.toHaveBeenCalled();

    await user.click(searchInput);
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("hands focus from the notice to the header Back button and keeps Escape leaving the page", async () => {
    const user = userEvent.setup();
    mockNavigate.mockClear();

    render(
      <KeyboardProvider>
        <HeaderChromeHarness>
          <Subject hasNotice />
        </HeaderChromeHarness>
      </KeyboardProvider>,
    );

    await user.click(screen.getByRole("textbox", { name: "Search providers" }));
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("falls back to the list zone when the notice disappears while focused", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <KeyboardProvider>
        <Subject hasNotice />
      </KeyboardProvider>,
    );

    await user.click(screen.getByRole("textbox", { name: "Search providers" }));
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();

    rerender(
      <KeyboardProvider>
        <Subject hasNotice={false} />
      </KeyboardProvider>,
    );

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    // The zone anchor left the page: list navigation must answer again.
    const listbox = screen.getByRole("listbox", { name: "Providers" });
    listbox.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();
  });

  it("parks focus off body while an activated action is pending, then reclaims it", async () => {
    const user = userEvent.setup();
    const runAction = vi.fn();

    const { rerender } = render(
      <KeyboardProvider>
        <Subject runControl={runAction} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    const action = screen.getByRole("button", { name: "Select configuration" });
    expect(action).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(runAction).toHaveBeenCalledTimes(1);

    // The mutation flips into pending: every action button renders natively disabled.
    rerender(
      <KeyboardProvider>
        <Subject runControl={runAction} isPending />
      </KeyboardProvider>,
    );

    expect(action).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId("details-focus-park")).toHaveFocus());
    expect(document.body).not.toHaveFocus();

    // The mutation completes: the row must reclaim the parked focus...
    rerender(
      <KeyboardProvider>
        <Subject runControl={runAction} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(action).toHaveFocus());

    // ...and Enter must activate again without an arrow press first.
    await user.keyboard("{Enter}");
    expect(runAction).toHaveBeenCalledTimes(2);
  });

  it("keeps ArrowDown on the parked fallback instead of hopping to the consent link", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <KeyboardProvider>
        <Subject hasConsentLink />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();

    rerender(
      <KeyboardProvider>
        <Subject hasConsentLink isPending />
      </KeyboardProvider>,
    );
    const park = screen.getByTestId("details-focus-park");
    await waitFor(() => expect(park).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(park).toHaveFocus();
  });

  it("returns focus to the rebuilt row when the activated control leaves it", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject activatesOnSelect />
      </KeyboardProvider>,
    );

    const providerList = screen.getByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(providerList).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Select configuration" })).toHaveFocus();

    // Selecting the configuration makes it the active one: the row rebuilds and
    // the activated button unmounts under the focus it was holding.
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Select configuration" })).not.toBeInTheDocument();
    const changeModel = screen.getByRole("button", { name: "Change model" });
    await waitFor(() => expect(changeModel).toHaveFocus());

    // Every direction still acts on the repaired focus.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(changeModel).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(changeModel).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(providerList).toHaveFocus();
    expect(screen.getByText("zone: list")).toBeInTheDocument();
  });

  it("leaves focus alone when it left the action row without the row rebuilding", async () => {
    const user = userEvent.setup();
    const runAction = vi.fn();

    render(
      <KeyboardProvider>
        <Subject runControl={runAction} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    const action = screen.getByRole("button", { name: "Select configuration" });
    expect(action).toHaveFocus();

    // Mirrors a Shift+Tab or a click onto nothing: the zone stays on the buttons
    // while the DOM focus leaves the row, and no control has changed.
    action.blur();

    await user.keyboard("{Enter}");
    expect(runAction).not.toHaveBeenCalled();
    await user.keyboard("{ArrowRight}");
    expect(action).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });
});
