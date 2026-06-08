// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchProvider, useSearchOpen } from "@/lib/search-context";
import { SearchDialog } from "./dialog";

const mocks = vi.hoisted(() => ({
  doSearch: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

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

function pageResult(id: string, title: string): ServerSearchResult {
  return {
    id,
    url: `/docs/ui/components/${id}`,
    type: "page",
    content: title,
    breadcrumbs: [],
  };
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

async function flushDebounce(ms = 150): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await Promise.resolve();
  });
}

async function renderOpenDialog(): Promise<HTMLElement> {
  render(<SearchDialog />, { wrapper: TestProviders });
  await act(async () => {});
  return screen.getByRole("combobox", { name: /command search/i });
}

describe("SearchDialog integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.open = false;
    });
    mocks.doSearch.mockReset();
    mocks.navigate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces server search, renders results, and activates the highlighted result", async () => {
    mocks.doSearch.mockResolvedValue([
      pageResult("button", "Button"),
      pageResult("callout", "Callout"),
    ]);

    const input = await renderOpenDialog();

    fireEvent.change(input, { target: { value: "button" } });
    await flushDebounce(149);
    expect(mocks.doSearch).not.toHaveBeenCalled();

    await flushDebounce(1);
    expect(mocks.doSearch).toHaveBeenCalledWith(expect.objectContaining({ data: "button" }));
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(screen.getByText("Callout")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/ui/components/callout" });
  });

  it("suppresses stale results when a slower earlier search resolves after the current query", async () => {
    let resolveFirst: (value: ServerSearchResult[]) => void = () => {};
    const firstSearch = new Promise<ServerSearchResult[]>((resolve) => {
      resolveFirst = resolve;
    });
    mocks.doSearch.mockReturnValueOnce(firstSearch);
    mocks.doSearch.mockResolvedValueOnce([pageResult("callout", "Callout")]);

    const input = await renderOpenDialog();

    fireEvent.change(input, { target: { value: "button" } });
    await flushDebounce();
    fireEvent.change(input, { target: { value: "callout" } });
    await flushDebounce();

    expect(screen.getByText("Callout")).toBeInTheDocument();
    expect(mocks.doSearch.mock.calls[0]?.[0]?.signal.aborted).toBe(true);

    await act(async () => {
      resolveFirst([pageResult("button", "Button")]);
      await Promise.resolve();
    });

    expect(screen.queryByText("Button")).not.toBeInTheDocument();
    expect(screen.getByText("Callout")).toBeInTheDocument();
  });

  it("renders search failures as an alert", async () => {
    mocks.doSearch.mockRejectedValue(new Error("network down"));

    const input = await renderOpenDialog();

    fireEvent.change(input, { target: { value: "button" } });
    await flushDebounce();

    expect(screen.getByRole("alert")).toHaveTextContent("Search failed. Try again.");
  });
});
