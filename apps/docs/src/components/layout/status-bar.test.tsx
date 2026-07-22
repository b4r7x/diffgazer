// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
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

  it.each([
    "/uix",
    "/application",
    "/keysmith",
  ])("marks no library link active on the root 404 path %s", (pathname) => {
    routerBoundary.pathname = pathname;
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Components" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it.each([
    ["/app", "Docs"],
    ["/ui", "Components"],
    ["/keys", "Keys"],
  ])("marks the exact library root %s active", (pathname, expectedName) => {
    routerBoundary.pathname = pathname;
    renderStatusBar();

    expect(screen.getByRole("link", { name: expectedName })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const activeLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(activeLinks).toHaveLength(1);
  });

  it("points each nav link at its library route", () => {
    routerBoundary.pathname = "/";
    renderStatusBar();

    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "Components" })).toHaveAttribute("href", "/ui");
    expect(screen.getByRole("link", { name: "Keys" })).toHaveAttribute("href", "/keys");
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it("exposes focusable links inside the Primary navigation landmark", async () => {
    const user = userEvent.setup();
    routerBoundary.pathname = "/";
    renderStatusBar();

    screen.getByRole("navigation", { name: "Primary" });

    const tabOrder = [
      screen.getByRole("link", { name: "diffgazer" }),
      screen.getByRole("link", { name: "Docs" }),
      screen.getByRole("link", { name: "Components" }),
      screen.getByRole("link", { name: "Keys" }),
      screen.getByRole("link", { name: "GitHub" }),
      screen.getByRole("button", { name: /switch to light theme/i }),
    ];

    for (const element of tabOrder) {
      await user.tab();
      expect(element).toHaveFocus();
    }
  });
});
