// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageTree } from "@/lib/page-tree";
import { stubMatchMedia } from "@/testing/match-media";
import { DocsSidebar } from "./sidebar";

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
  };
});

const TREE: PageTree = {
  name: "ui",
  children: [
    { type: "separator", name: "Components" },
    { type: "page", name: "Button", url: "/ui/components/button" },
    { type: "page", name: "Callout", url: "/ui/components/callout" },
  ],
};

function renderSidebar(onNavigate = vi.fn()) {
  window.history.replaceState(null, "", routerBoundary.pathname);
  render(<DocsSidebar tree={TREE} library="ui" onNavigate={onNavigate} />);
  return onNavigate;
}

beforeEach(() => {
  stubMatchMedia({ isDesktop: true });
  Element.prototype.scrollIntoView = () => {};
  routerBoundary.pathname = "/ui/components/button";
  window.history.replaceState(null, "", routerBoundary.pathname);
});

describe("DocsSidebar navigation", () => {
  it("does not navigate again when the active sidebar link is clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const bubbledDefaultPrevented: boolean[] = [];

    window.history.replaceState(null, "", routerBoundary.pathname);
    render(
      <div onClick={(event) => bubbledDefaultPrevented.push(event.defaultPrevented)}>
        <DocsSidebar tree={TREE} library="ui" onNavigate={onNavigate} />
      </div>,
    );

    await user.click(screen.getByRole("link", { name: "Button" }));

    expect(bubbledDefaultPrevented).toEqual([true]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("keeps normal navigation for inactive sidebar links", async () => {
    const user = userEvent.setup();
    const onNavigate = renderSidebar();

    const calloutLink = screen.getByRole("link", { name: "Callout" });
    expect(calloutLink).toHaveAttribute("href", "/ui/components/callout");

    await user.click(calloutLink);

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not react to the global Cmd/Ctrl+B sidebar hotkey", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.keyboard("{Meta>}b{/Meta}");

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );
  });
});
