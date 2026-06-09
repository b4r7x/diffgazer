// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/lib/mobile-nav-context";
import type { PageTree } from "@/lib/page-tree";
import { SearchProvider } from "@/lib/search-context";
import { CommandRow } from "./command-row";
import { DocsContentLayout } from "./content-layout";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/components/button",
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: { lib?: string; _splat?: string };
    children: ReactNode;
  } & Record<string, unknown>) => {
    let href = to;
    if (params?.lib) href = href.replace("$lib", params.lib);
    href = params?._splat ? href.replace("$", params._splat) : href.replace("/$", "");
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
    select({ pathname: routerBoundary.pathname }),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string }; status: "idle" }) => unknown;
  }) =>
    select({
      location: { pathname: routerBoundary.pathname },
      status: "idle",
    }),
  useRouter: () => ({
    subscribe: () => () => {},
  }),
}));

vi.mock("@/lib/use-pending-docs-route", () => ({
  usePendingDocsRoute: () => null,
}));

vi.mock("./sidebar-chrome", () => ({
  SidebarChrome: () => <div data-testid="sidebar-chrome" />,
}));

const TREE: PageTree = {
  name: "ui",
  children: [{ type: "page", name: "Button", url: "/ui/components/button" }],
};

function mockMobileViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  Element.prototype.scrollIntoView = () => {};
}

describe("DocsContentLayout mobile sidebar", () => {
  it("moves focus into the sidebar on open and restores it on Escape close", async () => {
    mockMobileViewport();
    const user = userEvent.setup();

    render(
      <MobileNavProvider>
        <SearchProvider>
          <CommandRow />
          <DocsContentLayout tree={TREE} library="ui">
            <p>Docs body</p>
          </DocsContentLayout>
        </SearchProvider>
      </MobileNavProvider>,
    );

    const menuButton = screen.getByRole("button", { name: /open navigation menu/i });
    await user.click(menuButton);

    const sidebarLink = await screen.findByRole("link", { name: "Button" });
    await waitFor(() => expect(sidebarLink).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);
    await waitFor(() => expect(menuButton).toHaveAttribute("aria-expanded", "true"));
    await waitFor(() => expect(screen.getByRole("link", { name: "Button" })).toBeVisible());
  });

});
