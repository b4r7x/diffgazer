// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  it("links theme, privacy, and terms to their routes", () => {
    routerBoundary.matches = [
      { routeId: "__root__", status: "success" },
      { routeId: "/", status: "success" },
    ];
    render(
      <KeyboardProvider>
        <FooterBar />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("link", { name: /theme/i })).toHaveAttribute("href", "/ui/theme");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });

  it("navigates to the theme page when F2 is pressed", async () => {
    routerBoundary.matches = [
      { routeId: "__root__", status: "success" },
      { routeId: "/", status: "success" },
    ];
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <FooterBar />
      </KeyboardProvider>,
    );

    await user.keyboard("{F2}");

    expect(navigateMock).toHaveBeenCalledWith({
      to: "/$lib/$",
      params: { lib: "ui", _splat: "theme" },
    });
  });

  it("shows list-navigation hints on the home page", () => {
    routerBoundary.matches = [
      { routeId: "__root__", status: "success" },
      { routeId: "/", status: "success" },
    ];
    render(
      <KeyboardProvider>
        <FooterBar />
      </KeyboardProvider>,
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
      <KeyboardProvider>
        <FooterBar />
      </KeyboardProvider>,
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
      <KeyboardProvider>
        <FooterBar />
      </KeyboardProvider>,
    );

    expect(screen.queryByText("prev/next")).not.toBeInTheDocument();
    expect(screen.queryByText("move")).not.toBeInTheDocument();
    expect(screen.queryByText("open")).not.toBeInTheDocument();
    expect(screen.getByText("search")).toBeInTheDocument();
  });
});
