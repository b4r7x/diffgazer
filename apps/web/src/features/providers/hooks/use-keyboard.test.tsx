import { getProviderRowId, type ProviderListRow } from "@diffgazer/core/providers";
import { buildProviderRows } from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProviderList } from "@/features/providers/components/list";
import { getProviderActions, isProviderActionDisabled, type ProviderAction } from "../lib/actions";
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

/** Mirrors the page layer: the same action array drives the buttons and the keyboard zone. */
function ActionButtons({
  actions,
  isPending = false,
  getButtonProps,
}: {
  actions: readonly ProviderAction[];
  isPending?: boolean;
  getButtonProps: ReturnType<typeof useProvidersKeyboard>["getActionButtonProps"];
}) {
  return (
    <>
      {actions.map((action, index) => (
        <button
          key={action.id}
          type="button"
          {...getButtonProps(index)}
          disabled={isProviderActionDisabled(action, isPending)}
        >
          {action.label}
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
  runAction = vi.fn(),
}: {
  filteredProviders?: ProviderListRow[];
  onSelectedId?: (id: string | null) => void;
  listReady?: boolean;
  isPending?: boolean;
  hasNotice?: boolean;
  runAction?: (action: ProviderAction) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    getProviderRowId(GEMINI_ROW as ProviderListRow),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const noticeActionRef = useRef<HTMLButtonElement>(null);
  const selectedRow =
    filteredProviders.find((row) => getProviderRowId(row) === selectedId) ??
    (GEMINI_ROW as ProviderListRow);
  const actions = getProviderActions(selectedRow);
  const keyboard = useProvidersKeyboard({
    actions,
    hasSelection: selectedRow !== null,
    listRowIds: (filteredProviders as ProviderListRow[]).map(getProviderRowId),
    listReady,
    filter: "all",
    setSelectedId: (id) => {
      onSelectedId(id);
      if (id) setSelectedId(id);
    },
    dialogOpen: false,
    isPending,
    hasNotice,
    inputRef,
    listContainerRef,
    noticeActionRef,
    runAction,
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
      <div ref={listContainerRef} tabIndex={0} role="listbox" aria-label="Providers">
        {selectedId}
      </div>
      {/* Mirrors details.tsx: an unlabelled tabIndex={-1} wrapper around the action row.
          Production gives it no role and no accessible name, so it is reached by test id. */}
      <div ref={keyboard.focusFallbackRef} tabIndex={-1} data-testid="details-focus-park">
        <ActionButtons
          actions={actions}
          isPending={isPending}
          getButtonProps={keyboard.getActionButtonProps}
        />
      </div>
    </>
  );
}

function ProviderListSubject({
  rows = ROWS,
  initialSelectedId = getProviderRowId(GEMINI_ROW as ProviderListRow),
  onFilter = vi.fn(),
  runAction = vi.fn(),
}: {
  rows?: ProviderListRow[];
  initialSelectedId?: string;
  onFilter?: (filter: ProviderFilter) => void;
  runAction?: (action: ProviderAction) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const noticeActionRef = useRef<HTMLButtonElement>(null);
  const selectedRow =
    rows.find((row) => getProviderRowId(row) === selectedId) ?? (GEMINI_ROW as ProviderListRow);
  const actions = getProviderActions(selectedRow);
  const keyboard = useProvidersKeyboard({
    actions,
    hasSelection: selectedRow !== null,
    listRowIds: rows.map(getProviderRowId),
    listReady: true,
    filter,
    setSelectedId: setSelectedId,
    dialogOpen: false,
    isPending: false,
    hasNotice: false,
    inputRef,
    listContainerRef,
    noticeActionRef,
    runAction,
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
      <ActionButtons actions={actions} getButtonProps={keyboard.getActionButtonProps} />
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

    expect(screen.getByRole("button", { name: "Delete configuration" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Select model" })).not.toBeDisabled();
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
    const runAction = vi.fn();

    render(
      <KeyboardProvider>
        <ProviderListSubject runAction={runAction} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(runAction).toHaveBeenCalledWith(expect.objectContaining({ id: "selectConfiguration" }));
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

  it("ignores ArrowUp from search when no notice renders", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject />
      </KeyboardProvider>,
    );

    const searchInput = screen.getByRole("textbox", { name: "Search providers" });
    await user.click(searchInput);

    await user.keyboard("{ArrowUp}");
    expect(searchInput).toHaveFocus();
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
        <Subject runAction={runAction} />
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
        <Subject runAction={runAction} isPending />
      </KeyboardProvider>,
    );

    expect(action).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId("details-focus-park")).toHaveFocus());
    expect(document.body).not.toHaveFocus();

    // The mutation completes: the row must reclaim the parked focus...
    rerender(
      <KeyboardProvider>
        <Subject runAction={runAction} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(action).toHaveFocus());

    // ...and Enter must activate again without an arrow press first.
    await user.keyboard("{Enter}");
    expect(runAction).toHaveBeenCalledTimes(2);
  });
});
