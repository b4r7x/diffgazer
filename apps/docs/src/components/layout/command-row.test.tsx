// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileNavProvider, useMobileNav } from "@/hooks/mobile-nav-context";
import { SearchProvider, useSearchOpen } from "@/hooks/search-context";
import { stubMatchMedia } from "@/testing/match-media";
import { CommandRow } from "./command-row";

const routerBoundary = vi.hoisted(() => ({ pathname: "/" }));

// Boundary mock: TanStack Router is the external routing library; this test controls the location-derived scope label.
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: routerBoundary.pathname } }),
}));

function SearchProbe() {
  const { open } = useSearchOpen();
  return <output aria-label="Search state">{open ? "open" : "closed"}</output>;
}

function RegisterSidebarProbe() {
  const { registerSidebar } = useMobileNav();
  return (
    <button type="button" onClick={() => registerSidebar()}>
      Register sidebar
    </button>
  );
}

describe("CommandRow", () => {
  it("opens search when the command row is clicked", async () => {
    stubMatchMedia({ isDesktop: true });
    const user = userEvent.setup();
    render(
      <MobileNavProvider>
        <SearchProvider>
          <SearchProbe />
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(screen.getByRole("status", { name: "Search state" })).toHaveTextContent("closed");
    await user.click(screen.getByRole("button", { name: /^search docs, components, hooks/i }));
    expect(screen.getByRole("status", { name: "Search state" })).toHaveTextContent("open");
  });

  it("names the search button from its visible prompt and shows the / binding", () => {
    stubMatchMedia({ isDesktop: true });
    routerBoundary.pathname = "/";
    render(
      <MobileNavProvider>
        <SearchProvider>
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    const button = screen.getByRole("button", { name: /^search docs, components, hooks/i });
    expect(button).toHaveTextContent("search docs, components, hooks…");
    expect(button).toHaveTextContent("/");
    expect(button.textContent).not.toContain("⌘");
  });

  it("shows the root scope on the home path", () => {
    stubMatchMedia({ isDesktop: true });
    routerBoundary.pathname = "/";
    render(
      <MobileNavProvider>
        <SearchProvider>
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(screen.getByText("[SCOPE: root]")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the library scope on a component docs page", () => {
    stubMatchMedia({ isDesktop: true });
    routerBoundary.pathname = "/ui/components/button";
    render(
      <MobileNavProvider>
        <SearchProvider>
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(screen.getByText("[SCOPE: @diffgazer/ui]")).toBeInTheDocument();
  });

  it("shows the mobile menu toggle only after a sidebar registers", async () => {
    stubMatchMedia({ isDesktop: false });
    const user = userEvent.setup();
    render(
      <MobileNavProvider>
        <SearchProvider>
          <RegisterSidebarProbe />
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(screen.queryByRole("button", { name: /open navigation menu/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Register sidebar" }));

    expect(screen.getByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
  });
});
