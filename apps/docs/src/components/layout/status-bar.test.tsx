// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusBar } from "./status-bar";

const routerBoundary = vi.hoisted(() => ({ pathname: "/ui/components/button" }));

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
    render(<StatusBar />);

    expect(screen.getByRole("link", { name: "Components" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Keys" })).not.toHaveAttribute("aria-current");
  });

  it("marks the home link active only on the root path", () => {
    routerBoundary.pathname = "/";
    render(<StatusBar />);

    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Components" })).not.toHaveAttribute("aria-current");
  });

  it("exposes a Primary navigation landmark with a visible focus ring on every link", () => {
    routerBoundary.pathname = "/";
    render(<StatusBar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.className).toContain("focus-visible:outline-2");
      expect(link.className).toContain("focus-visible:outline-ring");
    }
  });

  it("hides the informational status cluster below the md breakpoint", () => {
    routerBoundary.pathname = "/";
    render(<StatusBar />);

    const cluster = screen.getByText("USER: GUEST").parentElement;
    expect(cluster).not.toBeNull();
    expect(cluster?.className).toContain("hidden");
    expect(cluster?.className).toContain("md:flex");
  });
});
