// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { stubMatchMedia } from "@/testing/match-media";
import { FooterBar } from "./footer-bar";

const navigateMock = vi.hoisted(() => vi.fn());
type RouterMatch = { routeId: string; status: string; globalNotFound?: boolean };
const routerBoundary = vi.hoisted((): { matches: RouterMatch[] } => ({
  matches: [
    { routeId: "__root__", status: "success" },
    { routeId: "/", status: "success" },
  ],
}));

// Boundary mock: TanStack Router is the external routing library; F2 navigation and location-derived hints are asserted without a full route tree.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    useNavigate: () => navigateMock,
    useRouterState: ({
      select,
    }: {
      select: (state: { matches: typeof routerBoundary.matches }) => unknown;
    }) => select({ matches: routerBoundary.matches }),
  };
});

describe("FooterBar", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    stubMatchMedia({ isDesktop: true });
    navigateMock.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("links theme, privacy, and terms to their routes", () => {
    routerBoundary.matches = [
      { routeId: "__root__", status: "success" },
      { routeId: "/", status: "success" },
    ];
    render(
      <ThemeProvider>
        <KeyboardProvider>
          <FooterBar />
        </KeyboardProvider>
      </ThemeProvider>,
    );

    // The theme hint is a control, not a link: its label promises the switch,
    // so it performs the switch.
    expect(screen.queryByRole("link", { name: /theme/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();

    // Privacy and Terms are the only entry points to the legal pages, so they
    // must live in the footer landmark rather than in the route body.
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(within(footer).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });

  it("toggles the theme in place on F2 instead of navigating away", async () => {
    routerBoundary.matches = [
      { routeId: "__root__", status: "success" },
      { routeId: "/", status: "success" },
    ];
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <KeyboardProvider>
          <FooterBar />
        </KeyboardProvider>
      </ThemeProvider>,
    );

    const before = document.documentElement.getAttribute("data-theme");
    await user.keyboard("{F2}");

    expect(document.documentElement.getAttribute("data-theme")).not.toBe(before);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("toggles the theme from the footer hint itself", async () => {
    routerBoundary.matches = [
      { routeId: "__root__", status: "success" },
      { routeId: "/", status: "success" },
    ];
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <KeyboardProvider>
          <FooterBar />
        </KeyboardProvider>
      </ThemeProvider>,
    );

    const before = document.documentElement.getAttribute("data-theme");
    await user.click(screen.getByRole("button", { name: /theme/i }));

    expect(document.documentElement.getAttribute("data-theme")).not.toBe(before);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows list-navigation hints on the home page", () => {
    routerBoundary.matches = [
      { routeId: "__root__", status: "success" },
      { routeId: "/", status: "success" },
    ];
    render(
      <ThemeProvider>
        <KeyboardProvider>
          <FooterBar />
        </KeyboardProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText("move")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("F2")).toBeInTheDocument();
    expect(screen.queryByText("prev/next")).not.toBeInTheDocument();
  });

  it("shows prev/next hints on a docs page", () => {
    routerBoundary.matches = [
      { routeId: "__root__", status: "success" },
      { routeId: "/$lib", status: "success" },
      { routeId: "/$lib/$", status: "success" },
    ];
    render(
      <ThemeProvider>
        <KeyboardProvider>
          <FooterBar />
        </KeyboardProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText("prev/next")).toBeInTheDocument();
    expect(screen.getByText("search")).toBeInTheDocument();
    expect(screen.getByText("F2")).toBeInTheDocument();
    expect(screen.queryByText("move")).not.toBeInTheDocument();
  });

  it.each([
    ["docs not-found", [{ routeId: "/$lib", status: "notFound" }]],
    ["root not-found", [{ routeId: "__root__", status: "success", globalNotFound: true }]],
    ["root error", [{ routeId: "__root__", status: "error" }]],
  ])("suppresses route-local hints for %s state", (_label, matches) => {
    routerBoundary.matches = matches;
    render(
      <ThemeProvider>
        <KeyboardProvider>
          <FooterBar />
        </KeyboardProvider>
      </ThemeProvider>,
    );

    expect(screen.queryByText("prev/next")).not.toBeInTheDocument();
    expect(screen.queryByText("move")).not.toBeInTheDocument();
    expect(screen.queryByText("open")).not.toBeInTheDocument();
    expect(screen.getByText("search")).toBeInTheDocument();
  });
});
