// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type RecentDocsPage,
  SearchProvider,
  useDocsHistory,
  useSearchOpen,
} from "@/hooks/search-context";
import { SearchDialog } from "./dialog";

const mocks = vi.hoisted(() => ({
  doSearch: vi.fn(),
  navigate: vi.fn(),
}));

// Boundary mock: TanStack Router is the routing library boundary.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

// Boundary mock: TanStack Start server functions cross the client/server boundary.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => mocks.doSearch,
    }),
  }),
}));

interface ServerSearchResult {
  id: string;
  url: string;
  type: string;
  content: string;
  breadcrumbs: string[];
}

function pageResult(
  id: string,
  title: string,
  url = `/docs/ui/components/${id}`,
): ServerSearchResult {
  return {
    id,
    url,
    type: "page",
    content: title,
    breadcrumbs: [],
  };
}

function VisitRecorder({ pages }: { pages: RecentDocsPage[] }) {
  const { recordVisit } = useDocsHistory();
  useEffect(() => {
    for (const page of pages) recordVisit(page);
  }, [pages, recordVisit]);
  return null;
}

function OpenOnMount() {
  const { setOpen } = useSearchOpen();
  useEffect(() => setOpen(true), [setOpen]);
  return null;
}

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <KeyboardProvider>
      <SearchProvider>
        <OpenOnMount />
        {children}
      </SearchProvider>
    </KeyboardProvider>
  );
}

async function renderOpenDialog(): Promise<HTMLElement> {
  render(<SearchDialog />, { wrapper: TestProviders });
  await act(async () => {});
  return screen.getByRole("combobox", { name: /command search/i });
}

function setupUser() {
  return userEvent.setup();
}

describe("SearchDialog integration", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.open = false;
    });
    sessionStorage.clear();
    mocks.doSearch.mockReset();
    mocks.doSearch.mockResolvedValue([]);
    mocks.navigate.mockReset();
  });

  it("runs server search, renders results, and activates the highlighted result", async () => {
    const user = setupUser();
    mocks.doSearch.mockResolvedValue([
      pageResult("button", "Button"),
      pageResult("callout", "Callout"),
    ]);

    const input = await renderOpenDialog();

    await user.type(input, "button");
    await waitFor(() =>
      expect(mocks.doSearch).toHaveBeenCalledWith(expect.objectContaining({ data: "button" })),
    );
    expect(await screen.findByText("Button")).toBeInTheDocument();
    expect(screen.getByText("Callout")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/ui/components/callout" });
  });

  it("keeps duplicate-url results distinct for navigation and selection", async () => {
    const user = setupUser();
    const sharedUrl = "/docs/ui/components/shared";
    mocks.doSearch.mockResolvedValue([
      pageResult("first-hit", "First hit", sharedUrl),
      pageResult("second-hit", "Second hit", sharedUrl),
    ]);

    const input = await renderOpenDialog();
    await user.type(input, "shared");
    await waitFor(() =>
      expect(mocks.doSearch).toHaveBeenCalledWith(expect.objectContaining({ data: "shared" })),
    );

    const options = await screen.findAllByRole("option");
    const optionIds = options.map((option) => option.id);
    expect(new Set(optionIds).size).toBe(2);
    expect(screen.getAllByRole("option", { selected: true })).toHaveLength(1);
    expect(input).toHaveAttribute("aria-activedescendant", optionIds[0]);

    await user.keyboard("{ArrowDown}");

    expect(screen.getAllByRole("option", { selected: true })).toHaveLength(1);
    expect(input).toHaveAttribute("aria-activedescendant", optionIds[1]);

    await user.keyboard("{Enter}");
    expect(mocks.navigate).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/ui/components/shared" });
  });

  it("opens onto a launcher whose Jump targets are reachable with two keys", async () => {
    const user = setupUser();
    await renderOpenDialog();

    expect(screen.getByRole("group", { name: "Jump" })).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);

    await user.keyboard("{Enter}");
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("lists pages visited this session under Recent, most recent first", async () => {
    render(<SearchDialog />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestProviders>
          <VisitRecorder
            pages={[
              { title: "Button", url: "/ui/components/button", section: "components" },
              { title: "Callout", url: "/ui/components/callout", section: "components" },
            ]}
          />
          {children}
        </TestProviders>
      ),
    });
    await act(async () => {});

    const recent = screen.getByRole("group", { name: "Recent" });
    const titles = within(recent)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(titles[0]).toContain("Callout");
    expect(titles[1]).toContain("Button");
  });

  it("replaces the launcher with results on the first typed character", async () => {
    const user = setupUser();
    mocks.doSearch.mockResolvedValue([pageResult("button", "Button")]);

    const input = await renderOpenDialog();
    expect(screen.getByRole("group", { name: "Jump" })).toBeInTheDocument();

    await user.type(input, "b");

    expect(await screen.findByText("Button")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Jump" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("option", { selected: true })).toHaveLength(1);
  });

  it("announces search failures assertively outside the listbox", async () => {
    const user = setupUser();
    mocks.doSearch.mockRejectedValue(new Error("network down"));

    const input = await renderOpenDialog();

    await user.type(input, "button");

    // The error is announced assertively with the actual error copy.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Search failed. Try again.");
    expect(alert).toHaveAttribute("aria-live", "assertive");

    // The error message must not live inside the listbox (only options belong there).
    const listbox = screen.getByRole("listbox");
    expect(listbox).not.toHaveTextContent("Search failed. Try again.");
    expect(within(listbox).queryAllByRole("option")).toHaveLength(0);
  });

  it("announces empty results exactly once without an alert", async () => {
    const user = setupUser();
    mocks.doSearch.mockResolvedValue([]);

    const input = await renderOpenDialog();

    await user.type(input, "nomatch");

    expect(await screen.findByText("No results found.")).toBeInTheDocument();

    // The empty (success, zero matches) case keeps no app-level alert and is announced
    // exactly once by the palette's built-in polite "No results" live region.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);

    // The listbox holds only option children (zero here) during the empty state.
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).queryAllByRole("option")).toHaveLength(0);
  });

  // jsdom always reports a fine pointer, so this covers the close action's
  // behavior only; that it is *revealed* on touch is proven by the
  // mobile-chromium project in testing/e2e/pointer-coarse.e2e.ts.
  it("closes the dialog and clears the query from the Close search action", async () => {
    const user = setupUser();
    mocks.doSearch.mockResolvedValue([pageResult("button", "Button")]);

    const input = await renderOpenDialog();
    await user.type(input, "button");
    expect(await screen.findByText("Button")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close search" }));

    await waitFor(() =>
      expect(screen.queryByRole("combobox", { name: /command search/i })).not.toBeInTheDocument(),
    );

    await user.keyboard("/");

    const reopened = await screen.findByRole("combobox", { name: /command search/i });
    expect(reopened).toHaveValue("");
  });
});
