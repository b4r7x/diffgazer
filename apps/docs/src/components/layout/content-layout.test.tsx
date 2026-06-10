// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/lib/mobile-nav-context";
import type { PageTree } from "@/lib/page-tree";
import { SearchProvider } from "@/lib/search-context";
import { stubMatchMedia } from "@/testing/match-media";
import { CommandRow } from "./command-row";
import { DocsContentLayout } from "./content-layout";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/components/button",
}));

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

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => async () => ({ library: "ui", slugs: [] }),
    }),
  }),
}));

vi.mock("@/lib/use-pending-docs-route", () => ({
  usePendingDocsRoute: () => null,
}));

vi.mock("@/generated/sections-with-index", () => ({
  SECTIONS_WITH_INDEX: new Set(["ui/components"]),
}));

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", TestResizeObserver);

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
