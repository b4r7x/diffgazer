import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import { expectSingleReticle } from "@/testing/reticle";
import { HelpPage } from "./page";

function renderPage() {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <FooterProvider>
        <KeyboardProvider>{children}</KeyboardProvider>
      </FooterProvider>
    );
  }

  return render(<HelpPage />, { wrapper: Wrapper });
}

describe("HelpPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("names the panel region with the single visible Help title", () => {
    renderPage();

    expect(screen.getByRole("region", { name: /^help$/i })).toBeInTheDocument();
    // getByRole throws on multiple matches, so this also proves the title appears once.
    expect(screen.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
  });

  it("lists keyboard shortcuts and navigates home on Escape", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("heading", { name: /keyboard shortcuts/i })).toBeVisible();
    expect(screen.getByRole("list", { name: "Anywhere" })).toBeVisible();
    expect(screen.getAllByText("Move the highlight")).toHaveLength(1);

    await user.keyboard("{Escape}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("renders exactly one bracketed element: the help sheet itself", () => {
    const { container } = renderPage();

    expectSingleReticle(container);
  });

  it("groups the shortcuts by context in the canonical order", () => {
    renderPage();

    const groupHeadings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(groupHeadings).toEqual(["Anywhere", "In lists", "In a review", "In history"]);

    for (const name of ["Anywhere", "In lists", "In a review", "In history"]) {
      expect(screen.getByRole("list", { name })).toBeInTheDocument();
    }
  });

  it("keeps the two ↑/↓ rows apart by context instead of by label", () => {
    renderPage();

    const lists = ["In lists", "In a review"].map((name) =>
      screen.getByRole("list", { name }),
    ) as HTMLElement[];
    expect(within(lists[0] as HTMLElement).getByText("↑/↓")).toBeVisible();
    expect(within(lists[0] as HTMLElement).getByText("Move the highlight")).toBeVisible();
    expect(within(lists[1] as HTMLElement).getByText("↑/↓")).toBeVisible();
    expect(within(lists[1] as HTMLElement).getByText("Scroll the focused pane")).toBeVisible();
  });

  it("advertises history search in its own context group", () => {
    renderPage();

    const history = screen.getByRole("list", { name: "In history" });
    expect(within(history).getByText("Search Runs")).toBeVisible();
    expect(within(history).getByText("/")).toBeVisible();
  });

  it("advertises the live web-only h and ? bindings and omits the nonexistent r/R rows", () => {
    renderPage();

    expect(screen.getByText("Open History")).toBeVisible();
    expect(screen.getByText("Open Help")).toBeVisible();
    expect(screen.queryByText("Review Unstaged Changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Review Staged Changes")).not.toBeInTheDocument();
  });

  it("gives each review scroll key its own truthful row", () => {
    renderPage();

    const shortcuts = screen.getByRole("list", { name: "In a review" });
    const rows: [string, string][] = [
      ["↑/↓", "Scroll the focused pane"],
      ["PgUp/PgDn", "Page up or down"],
      ["Home/End", "Jump to start or end"],
    ];
    for (const [key, label] of rows) {
      expect(within(shortcuts).getAllByText(key).length).toBeGreaterThan(0);
      expect(within(shortcuts).getByText(label)).toBeVisible();
    }
  });

  it("still collapses the keys that do share one action into a single row", () => {
    renderPage();

    const lists = screen.getByRole("list", { name: "In lists" });
    expect(within(lists).getAllByText("Move the highlight")).toHaveLength(1);
    for (const key of ["↑/↓", "j/k"]) {
      expect(within(lists).getAllByText(key).length).toBeGreaterThan(0);
    }
  });

  it("lists touch gestures for touch devices", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /touch gestures/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /touch gestures/i })).toBeInTheDocument();
    expect(screen.getByText("Tap")).toBeInTheDocument();
    expect(screen.getByText("Swipe")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });
});
