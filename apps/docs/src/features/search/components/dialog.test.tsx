// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResult, SearchStatus } from "../hooks/use-search";
import { getSearchStatusView, SearchDialog } from "./dialog";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: vi.fn(),
  setOpen: vi.fn(),
  state: {
    query: "",
    results: [] as SearchResult[],
    status: "idle" as SearchStatus,
    error: null as string | null,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("../hooks/use-search", () => ({
  useSearch: () => ({
    ...mocks.state,
    search: mocks.search,
  }),
}));

vi.mock("@/lib/search-context", () => ({
  useSearchOpen: () => ({ open: true, setOpen: mocks.setOpen }),
}));

function renderDialog() {
  return render(
    <KeyboardProvider>
      <SearchDialog />
    </KeyboardProvider>,
  );
}

describe("getSearchStatusView", () => {
  it("returns an alert for search errors", () => {
    expect(getSearchStatusView(true, "error", "Search failed. Try again.")).toEqual({
      message: "Search failed. Try again.",
      role: "alert",
    });
  });
});

describe("SearchDialog", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.open = false;
    });
    mocks.navigate.mockReset();
    mocks.search.mockReset();
    mocks.state.query = "button";
    mocks.state.status = "success";
    mocks.state.error = null;
    mocks.state.results = [
      {
        id: "button",
        url: "/ui/components/button",
        title: "Button",
        excerpt: "",
        section: "components",
        library: "ui",
      },
      {
        id: "callout",
        url: "/ui/components/callout",
        title: "Callout",
        excerpt: "",
        section: "components",
        library: "ui",
      },
    ];
  });

  it("navigates to the highlighted result with keyboard", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByRole("combobox"), "{ArrowDown}{Enter}");

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/ui/components/callout" });
  });
});
