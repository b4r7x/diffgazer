// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageTree } from "@/lib/page-tree";
import { DocsSidebar } from "./sidebar";

const routerBoundary = vi.hoisted(() => ({
  navigations: [] as string[],
  pathname: "/ui/components/button",
}));

type LinkProps = {
  to: string;
  params?: { lib?: string; _splat?: string };
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, onClick, ...rest }: LinkProps) => {
    let href = to;
    if (params?.lib) href = href.replace("$lib", params.lib);
    href = params?._splat ? href.replace("$", params._splat) : href.replace("/$", "");

    return (
      <a
        {...rest}
        href={href}
        onClick={(event) => {
          onClick?.(event);
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          event.preventDefault();
          routerBoundary.navigations.push(href);
        }}
      >
        {children}
      </a>
    );
  },
  useLocation: ({
    select,
  }: {
    select: (location: { href: string; pathname: string }) => unknown;
  }) =>
    select({
      href: routerBoundary.pathname,
      pathname: routerBoundary.pathname,
    }),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string }; status: "idle" }) => unknown;
  }) =>
    select({
      location: { pathname: routerBoundary.pathname },
      status: "idle",
    }),
}));

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
  Object.defineProperty(window, "matchMedia", {
    value: (query: string) => ({
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {},
    }),
    writable: true,
  });
  Element.prototype.scrollIntoView = () => {};
  routerBoundary.navigations.length = 0;
  routerBoundary.pathname = "/ui/components/button";
  window.history.replaceState(null, "", routerBoundary.pathname);
});

describe("DocsSidebar navigation", () => {
  it("does not navigate again when the active sidebar link is clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = renderSidebar();

    await user.click(screen.getByRole("link", { name: "Button" }));

    expect(routerBoundary.navigations).toEqual([]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("keeps normal navigation for inactive sidebar links", async () => {
    const user = userEvent.setup();
    const onNavigate = renderSidebar();

    await user.click(screen.getByRole("link", { name: "Callout" }));

    expect(routerBoundary.navigations).toEqual(["/ui/components/callout"]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
