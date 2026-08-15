import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
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

  it("ships the mobile menu toggle in the server markup, before any client state settles", () => {
    routerBoundary.pathname = "/ui/components/button";

    const html = renderToStaticMarkup(
      <MobileNavProvider>
        <SearchProvider>
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(html).toContain('aria-label="Open navigation menu"');
    expect(html).toContain('aria-controls="sidebar-nav"');
  });

  it("renders the mobile menu toggle on a desktop viewport too, leaving the breakpoint to CSS", () => {
    stubMatchMedia({ isDesktop: true });
    render(
      <MobileNavProvider>
        <SearchProvider>
          <CommandRow />
        </SearchProvider>
      </MobileNavProvider>,
    );

    expect(screen.getByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
  });
});
