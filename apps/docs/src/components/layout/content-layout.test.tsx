// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocsPageHeader } from "@/components/page-layout";
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
  const { RouterLinkMock, useLocationMock, useRouterStateMock } = await import(
    "@/testing/router-mock"
  );
  return {
    Link: RouterLinkMock,
    ...useLocationMock({
      get pathname() {
        return routerBoundary.pathname;
      },
    }),
    ...useRouterStateMock({
      get pathname() {
        return routerBoundary.pathname;
      },
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
  it("moves focus to the drawer on open, into it on Tab, and restores it on Escape close", async () => {
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

    const drawer = screen.getByRole("complementary", { name: /sidebar navigation/i });
    const scopeTrigger = screen.getByRole("combobox", { name: /select documentation library/i });
    await waitFor(() => expect(drawer).toHaveFocus());
    expect(scopeTrigger).not.toHaveFocus();

    await user.tab();
    expect(scopeTrigger).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);
    await waitFor(() => expect(menuButton).toHaveAttribute("aria-expanded", "true"));
    await waitFor(() => expect(drawer).toHaveFocus());
  });
});

const SECTIONED_TREE: PageTree = {
  name: "ui",
  children: [
    { type: "separator", name: "Components" },
    { type: "page", name: "Button", url: "/ui/components/button" },
  ],
};

describe("DocsContentLayout content breadcrumbs", () => {
  it("exposes exactly one Breadcrumb landmark in the content column, in the page header", () => {
    stubMatchMedia({ isDesktop: false });
    routerBoundary.pathname = "/ui/components/button";

    render(
      <KeyboardProvider>
        <MobileNavProvider>
          <SearchProvider>
            <DocsContentLayout tree={SECTIONED_TREE} library="ui">
              <DocsPageHeader title="Button" lib="ui" slug="components/button" />
            </DocsContentLayout>
          </SearchProvider>
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    const main = screen.getByRole("main");
    // The shell no longer prints its own PATH row: the header's scope line is
    // the single copy of the path inside the article column.
    const paths = within(main).getAllByRole("navigation", { name: "Breadcrumb" });
    expect(paths).toHaveLength(1);

    const path = paths[0];
    if (!path) throw new Error("breadcrumb landmark missing");
    expect(within(path).getByRole("link", { name: "components" })).toHaveAttribute(
      "href",
      "/ui/components",
    );
    expect(within(main).getByText("button")).toBeInTheDocument();
  });
});
