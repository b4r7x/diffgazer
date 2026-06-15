// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
import { SearchProvider } from "@/hooks/search-context";
import type { PageTree } from "@/lib/page-tree";
import { stubMatchMedia } from "@/testing/match-media";
import { CommandRow } from "./command-row";
import { DocsContentLayout } from "./content-layout";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/components/button",
}));

// Boundary mock: @tanstack/react-router is the external route context boundary.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
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
    useNavigate: () => () => {},
  };
});

// Boundary mock: @tanstack/react-start server functions are unavailable in jsdom.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => async () => ({ library: "ui", slugs: [] }),
    }),
  }),
}));

// Boundary mock: generated build artifact (jsdom has no @/generated data)
vi.mock("@/generated/sections-with-index", () => ({
  SECTIONS_WITH_INDEX: new Set(["ui/components"]),
}));

const TREE: PageTree = {
  name: "ui",
  children: [{ type: "page", name: "Button", url: "/ui/components/button" }],
};

describe("DocsContentLayout mobile sidebar", () => {
  it("moves focus to the Scope select trigger on open and restores it on Escape close", async () => {
    stubMatchMedia({ isDesktop: false });
    Element.prototype.scrollIntoView = () => {};
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <MobileNavProvider>
          <SearchProvider>
            <CommandRow />
            <DocsContentLayout tree={TREE} library="ui">
              <p>Docs body</p>
            </DocsContentLayout>
          </SearchProvider>
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    const menuButton = screen.getByRole("button", { name: /open navigation menu/i });
    await user.click(menuButton);

    const scopeTrigger = screen.getByRole("combobox", { name: /select documentation library/i });
    await waitFor(() => expect(scopeTrigger).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);
    await waitFor(() => expect(menuButton).toHaveAttribute("aria-expanded", "true"));
    await waitFor(() => expect(scopeTrigger).toHaveFocus());
  });
});
