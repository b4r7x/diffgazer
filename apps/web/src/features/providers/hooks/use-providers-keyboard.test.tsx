import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { useRef, useState } from "react";
import type { AIProvider, ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { ProviderList } from "@/features/providers/components/provider-list";
import { useProvidersKeyboard } from "./use-providers-keyboard";
import { PROVIDER_FILTERS, type ProviderFilter } from "@/features/providers/constants";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

const DEFAULT_PROVIDER = {
  id: "gemini" as AIProvider,
  hasApiKey: false,
  model: "gemini-2.5-flash",
  name: "Gemini",
};

const PROVIDERS: ProviderWithStatus[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash"],
    hasApiKey: false,
    isActive: false,
    model: "gemini-2.5-flash",
    displayStatus: "needs-key",
  },
  {
    id: "zai",
    name: "Z.AI",
    defaultModel: "glm-4.7",
    models: ["glm-4.7"],
    hasApiKey: true,
    isActive: true,
    model: "glm-4.7",
    displayStatus: "active",
  },
];

function Subject({
  filteredProviders = [{ id: "gemini" }, { id: "zai" }],
  onSelectedId = vi.fn(),
  listReady = true,
}: {
  filteredProviders?: Array<{ id: string }>;
  onSelectedId?: (id: string) => void;
  listReady?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(DEFAULT_PROVIDER.id);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedProvider = { ...DEFAULT_PROVIDER, id: selectedId as AIProvider };
  const keyboard = useProvidersKeyboard({
    selectedProvider,
    filteredProviders,
    listReady,
    filter: "all",
    setSelectedId: (id) => {
      onSelectedId(id);
      setSelectedId(id as AIProvider);
    },
    dialogOpen: false,
    inputRef,
    listContainerRef,
    onSetApiKey: vi.fn(),
    onSelectModel: vi.fn(),
    onRemoveKey: vi.fn(async () => {}),
    onSelectProvider: vi.fn(async () => {}),
  });

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
        Connect
      </button>
      <button type="button" {...keyboard.getActionButtonProps(1)}>
        API Key
      </button>
    </>
  );
}

function renderSubject(props: Parameters<typeof Subject>[0] = {}) {
  return render(
    <KeyboardProvider>
      <Subject {...props} />
    </KeyboardProvider>,
  );
}

function ProviderListSubject({
  onFilter = vi.fn(),
}: {
  onFilter?: (filter: ProviderFilter) => void;
}) {
  const [selectedId, setSelectedId] = useState<AIProvider>("gemini");
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedProvider = PROVIDERS.find((provider) => provider.id === selectedId) ?? null;
  const applyFilter = (nextFilter: ProviderFilter) => {
    setFilter(nextFilter);
    onFilter(nextFilter);
  };
  const keyboard = useProvidersKeyboard({
    selectedProvider,
    filteredProviders: PROVIDERS,
    listReady: true,
    filter,
    setSelectedId: (id) => setSelectedId(id as AIProvider),
    dialogOpen: false,
    inputRef,
    listContainerRef,
    onSetApiKey: vi.fn(),
    onSelectModel: vi.fn(),
    onRemoveKey: vi.fn(async () => {}),
    onSelectProvider: vi.fn(async () => {}),
  });

  return (
    <ProviderList
      ref={listContainerRef}
      providers={PROVIDERS}
      selectedId={selectedId}
      highlighted={selectedId}
      onSelect={(id) => setSelectedId(id as AIProvider)}
      onHighlightChange={(id) => setSelectedId(id as AIProvider)}
      filter={filter}
      onFilterChange={applyFilter}
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
      onBoundaryReached={keyboard.handleListBoundary}
    />
  );
}

function renderProviderListSubject(props: Parameters<typeof ProviderListSubject>[0] = {}) {
  return render(
    <KeyboardProvider>
      <ProviderListSubject {...props} />
    </KeyboardProvider>,
  );
}

describe("useProvidersKeyboard", () => {
  it("describes provider badge and model without duplicating subtitle text", () => {
    render(
      <ProviderList
        providers={PROVIDERS}
        selectedId="gemini"
        onSelect={vi.fn()}
        filter="all"
        onFilterChange={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );

    const option = screen.getByRole("option", { name: "Google Gemini" });
    const describedBy = option.getAttribute("aria-describedby")?.split(/\s+/) ?? [];

    expect(option).toHaveAccessibleDescription("FREE gemini-2.5-flash");
    expect(describedBy).toHaveLength(2);
    expect(document.getElementById(describedBy[0] ?? "")).toHaveTextContent("FREE");
    expect(document.getElementById(describedBy[1] ?? "")).toHaveTextContent("gemini-2.5-flash");
  });

  it("focuses the provider list after it becomes ready", async () => {
    const { rerender } = renderSubject({ listReady: false });

    expect(screen.getByRole("listbox", { name: "Providers" })).not.toHaveFocus();

    rerender(
      <KeyboardProvider>
        <Subject listReady />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus());
  });

  it("moves real focus from the provider list to action buttons and back", async () => {
    const user = userEvent.setup();

    renderSubject();

    const providerList = screen.getByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(providerList).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Connect" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(providerList).toHaveFocus();
  });

  it("selects the first filtered provider when moving from filters down to the list", async () => {
    const user = userEvent.setup();
    const onSelectedId = vi.fn();

    renderSubject({
      filteredProviders: [{ id: "openrouter" }, { id: "zai" }],
      onSelectedId,
    });

    await user.keyboard("/");
    const search = screen.getByRole("textbox", { name: "Search providers" });
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "all" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(onSelectedId).toHaveBeenCalledWith("openrouter");
    expect(screen.getByRole("listbox", { name: "Providers" })).toHaveTextContent("openrouter");
    expect(screen.getByRole("listbox", { name: "Providers" })).toHaveFocus();
  });

  it("keeps zone state in sync when search and filters receive real focus", async () => {
    const user = userEvent.setup();

    renderSubject();

    await user.click(screen.getByRole("textbox", { name: "Search providers" }));
    expect(screen.getByRole("textbox", { name: "Search providers" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "all" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "all" }));
    expect(screen.getByRole("button", { name: "all" })).toHaveFocus();
  });

  it("changes provider filters through ProviderList roving filter controls", async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();

    renderProviderListSubject({ onFilter });

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());

    await user.keyboard("/");
    expect(screen.getByRole("searchbox", { name: /search providers/i })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "All" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");

    const configuredFilter = screen.getByRole("radio", { name: "Configured" });
    expect(configuredFilter).toHaveFocus();
    expect(configuredFilter).toHaveAttribute("aria-checked", "true");
    expect(onFilter).toHaveBeenCalledWith("configured");
  });

  it("moves from provider search to filters on Escape", async () => {
    const user = userEvent.setup();

    renderProviderListSubject();

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("/");
    const search = screen.getByRole("searchbox", { name: /search providers/i });
    expect(search).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.getByRole("radio", { name: "All" })).toHaveFocus();
  });
});
