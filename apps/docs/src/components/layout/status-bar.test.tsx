// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { StatusBar } from "./status-bar";

function renderStatusBar() {
  return render(
    <ThemeProvider>
      <StatusBar />
    </ThemeProvider>,
  );
}

const routerBoundary = vi.hoisted(() => ({ pathname: "/ui/components/button" }));

// Boundary mock: TanStack Router is the external routing library; this test controls location-derived active links.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useRouterState: ({
      select,
    }: {
      select: (state: { location: { pathname: string } }) => unknown;
    }) => select({ location: { pathname: routerBoundary.pathname } }),
  };
});

describe("StatusBar", () => {
  it("marks the active library link with aria-current=page", () => {
    routerBoundary.pathname = "/ui/components/button";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Components" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it("marks the Docs link active on app docs pages", () => {
    routerBoundary.pathname = "/app/getting-started";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Components" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it("marks no nav link active on the root path", () => {
    routerBoundary.pathname = "/";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Components" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it("points each nav link at its library route", () => {
    routerBoundary.pathname = "/";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "Components" })).toHaveAttribute("href", "/ui");
    expect(screen.getByRole("link", { name: "Keys" })).toHaveAttribute("href", "/keys");
  });

  it("exposes focusable links inside the Primary navigation landmark", () => {
    routerBoundary.pathname = "/";
    renderStatusBar();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      link.focus();
      expect(link).toHaveFocus();
    }
  });

  it("toggles the document theme via the chrome toggle", async () => {
    const user = userEvent.setup();
    routerBoundary.pathname = "/";
    renderStatusBar();

    const toggle = screen.getByRole("button", { name: /switch to light theme/i });
    await user.click(toggle);

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();
  });
});
