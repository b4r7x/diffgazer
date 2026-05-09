import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { useRef, useState } from "react";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { useProvidersKeyboard } from "./use-providers-keyboard";

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

function Subject({
  filteredProviders = [{ id: "gemini" }, { id: "zai" }],
  onSelectedId = vi.fn(),
}: {
  filteredProviders?: Array<{ id: string }>;
  onSelectedId?: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(DEFAULT_PROVIDER.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedProvider = { ...DEFAULT_PROVIDER, id: selectedId as AIProvider };
  const keyboard = useProvidersKeyboard({
    selectedProvider,
    filteredProviders,
    filter: "all",
    setFilter: vi.fn(),
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
      <input ref={inputRef} data-testid="provider-search" onFocus={keyboard.handleSearchFocus} />
      <button type="button" data-testid="filter-all" onFocus={() => keyboard.handleFilterFocus(0)}>
        All
      </button>
      <div ref={listContainerRef} tabIndex={0} data-testid="provider-list">
        {selectedId}
      </div>
      <button type="button" data-testid="connect" {...keyboard.getActionButtonProps(0)}>
        Connect
      </button>
      <button type="button" data-testid="api-key" {...keyboard.getActionButtonProps(1)}>
        API Key
      </button>
      <span data-testid="zone">{keyboard.focusZone}</span>
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

describe("useProvidersKeyboard", () => {
  it("moves real focus from the provider list to action buttons and back", async () => {
    const user = userEvent.setup();

    renderSubject();

    await waitFor(() => expect(screen.getByTestId("provider-list")).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("connect")).toHaveFocus();
    expect(screen.getByTestId("zone")).toHaveTextContent("buttons");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("provider-list")).toHaveFocus();
    expect(screen.getByTestId("zone")).toHaveTextContent("list");
  });

  it("selects the first filtered provider when moving from filters down to the list", async () => {
    const user = userEvent.setup();
    const onSelectedId = vi.fn();

    renderSubject({
      filteredProviders: [{ id: "openrouter" }, { id: "zai" }],
      onSelectedId,
    });

    await user.keyboard("/");
    expect(screen.getByTestId("provider-search")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("zone")).toHaveTextContent("filters");

    await user.keyboard("{ArrowDown}");
    expect(onSelectedId).toHaveBeenCalledWith("openrouter");
    expect(screen.getByTestId("provider-list")).toHaveTextContent("openrouter");
  });

  it("keeps zone state in sync when search and filters receive real focus", async () => {
    const user = userEvent.setup();

    renderSubject();

    await user.click(screen.getByTestId("provider-search"));
    expect(screen.getByTestId("zone")).toHaveTextContent("input");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("zone")).toHaveTextContent("filters");

    await user.click(screen.getByTestId("filter-all"));
    expect(screen.getByTestId("zone")).toHaveTextContent("filters");
  });
});
