import { getProviderRowId, type ProviderListRow } from "@diffgazer/core/providers";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProviderList } from "@/features/providers/components/list";
import { PROVIDER_FILTERS, type ProviderFilter } from "../lib/filter";
import { buildProviderRows } from "../testing/fixtures";
import { useProvidersKeyboard } from "./use-keyboard";

const ROWS: ProviderListRow[] = buildProviderRows();
const GEMINI_ROW = ROWS.find((row) => row.configuration?.configurationId === "gemini-primary");
const ZAI_ROW = ROWS.find((row) => row.configuration?.configurationId === "zai-primary");
if (!GEMINI_ROW || !ZAI_ROW) throw new Error("Missing fixture rows");

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

function Subject({
  filteredProviders = ROWS,
  onSelectedId = vi.fn(),
  listReady = true,
}: {
  filteredProviders?: ProviderListRow[];
  onSelectedId?: (id: string | null) => void;
  listReady?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    getProviderRowId(GEMINI_ROW as ProviderListRow),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedRow =
    filteredProviders.find((row) => getProviderRowId(row) === selectedId) ??
    (GEMINI_ROW as ProviderListRow);
  const keyboard = useProvidersKeyboard({
    selectedRow,
    filteredProviders: filteredProviders as ProviderListRow[],
    listReady,
    filter: "all",
    setSelectedId: (id) => {
      onSelectedId(id);
      if (id) setSelectedId(id);
    },
    dialogOpen: false,
    inputRef,
    listContainerRef,
    onSetup: vi.fn(),
    onSelectModel: vi.fn(),
    onDelete: vi.fn(),
    onDispatchAction: vi.fn(),
  });
  const primarySlot = keyboard.getActionSlot(0);

  return (
    <>
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
          {...keyboard.getFilterButtonProps(index)}
        >
          {filter}
        </button>
      ))}
      <div ref={listContainerRef} tabIndex={0} role="listbox" aria-label="Providers">
        {selectedId}
      </div>
      <button type="button" {...keyboard.getActionButtonProps(0)}>
        {primarySlot.label}
      </button>
      <button type="button" {...keyboard.getActionButtonProps(1)}>
        Setup
      </button>
    </>
  );
}

function ProviderListSubject({
  onFilter = vi.fn(),
  onActivate = vi.fn(),
  onDispatchAction = vi.fn(),
}: {
  onFilter?: (filter: ProviderFilter) => void;
  onActivate?: (id: string) => void;
  onDispatchAction?: (row: ProviderListRow) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    getProviderRowId(GEMINI_ROW as ProviderListRow),
  );
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedRow =
    ROWS.find((row) => getProviderRowId(row) === selectedId) ?? (GEMINI_ROW as ProviderListRow);
  const keyboard = useProvidersKeyboard({
    selectedRow,
    filteredProviders: ROWS as ProviderListRow[],
    listReady: true,
    filter,
    setSelectedId: setSelectedId,
    dialogOpen: false,
    inputRef,
    listContainerRef,
    onSetup: vi.fn(),
    onSelectModel: vi.fn(),
    onDelete: vi.fn(),
    onDispatchAction,
  });

  return (
    <>
      <ProviderList
        ref={listContainerRef}
        providers={ROWS}
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
        onFilterHighlightChange={keyboard.setFilterIndex}
        onFilterFocus={keyboard.handleFilterFocus}
        onFilterKeyDown={keyboard.handleFilterKeyDown}
        getFilterButtonProps={keyboard.getFilterButtonProps}
        onListKeyDown={keyboard.handleListKeyDown}
        onActivate={onActivate}
        onBoundaryReached={keyboard.handleListBoundary}
      />
      <button type="button" {...keyboard.getActionButtonProps(0)}>
        {keyboard.getActionSlot(0).label}
      </button>
      <button
        type="button"
        disabled={!keyboard.getActionSlot(2).enabled}
        aria-disabled={!keyboard.getActionSlot(2).enabled}
        title={keyboard.getActionSlot(2).disabledReason}
        {...keyboard.getActionButtonProps(2)}
      >
        Delete configuration
      </button>
      <button
        type="button"
        disabled={!keyboard.getActionSlot(3).enabled}
        aria-disabled={!keyboard.getActionSlot(3).enabled}
        {...keyboard.getActionButtonProps(3)}
      >
        Select model
      </button>
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

  it("announces disabled reasons for unavailable actions", () => {
    const removedRow = ROWS.find(
      (row) => row.configuration?.configurationId === "legacy-removed-zai-plan",
    );
    if (!removedRow) throw new Error("Missing removed fixture");

    render(
      <KeyboardProvider>
        <ProviderListSubject onDispatchAction={vi.fn()} />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("button", { name: "Delete configuration" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Select model" })).not.toBeDisabled();
  });

  it("keeps Select configuration reachable for setup routing", async () => {
    const user = userEvent.setup();
    const onDispatchAction = vi.fn();

    render(
      <KeyboardProvider>
        <ProviderListSubject onDispatchAction={onDispatchAction} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onDispatchAction).toHaveBeenCalled();
  });

  it("never activates removed records from the list keyboard flow", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();

    render(
      <KeyboardProvider>
        <ProviderListSubject onActivate={onActivate} />
      </KeyboardProvider>,
    );

    const listbox = screen.getByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

    expect(onActivate).not.toHaveBeenCalledWith("legacy-removed-zai-plan");
  });
});
