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
    expect(screen.getByRole("list", { name: /keyboard shortcuts/i })).toBeVisible();
    expect(screen.getByText("Navigate Menus and Lists")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("advertises the live web-only h and ? bindings and omits the nonexistent r/R rows", () => {
    renderPage();

    expect(screen.getByText("Open History")).toBeVisible();
    expect(screen.getByText("Open Help")).toBeVisible();
    expect(screen.queryByText("Review Unstaged Changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Review Staged Changes")).not.toBeInTheDocument();
  });

  it("shows one row per action instead of repeating the scroll label per key", () => {
    renderPage();

    expect(screen.getAllByText("Scroll Content")).toHaveLength(1);

    const shortcuts = screen.getByRole("list", { name: /keyboard shortcuts/i });
    for (const key of ["↑/↓", "PgUp/PgDn", "Home/End"]) {
      expect(within(shortcuts).getAllByText(key).length).toBeGreaterThan(0);
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
