// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
      <a href={href} data-tanstack-link="true" {...rest}>
        {children}
      </a>
    );
  },
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
    select({ pathname: routerBoundary.pathname }),
}));

vi.mock("@/generated/sections-with-index", () => ({
  SECTIONS_WITH_INDEX: new Set(["ui/components", "ui/components/button"]),
}));

import { Breadcrumbs } from "./breadcrumbs";

describe("Breadcrumbs", () => {
  it("uses TanStack typed links for linkable breadcrumb segments", () => {
    routerBoundary.pathname = "/ui/components/button";
    render(<Breadcrumbs />);

    const componentsLink = screen.getByRole("link", { name: "components" });
    expect(componentsLink).toHaveAttribute("data-tanstack-link", "true");
    expect(componentsLink).toHaveAttribute("href", "/ui/components");
    expect(screen.queryByRole("link", { name: "button" })).not.toBeInTheDocument();
  });

  it("does not render nested interactive controls", () => {
    routerBoundary.pathname = "/ui/components/button";
    const { container } = render(<Breadcrumbs />);

    for (const link of container.querySelectorAll("a")) {
      expect(link.querySelector("button")).toBeNull();
      expect(link.querySelector("a")).toBeNull();
    }
  });
});
