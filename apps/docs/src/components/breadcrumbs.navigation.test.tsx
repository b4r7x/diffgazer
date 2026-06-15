// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/hooks/composed-refs",
}));

// Boundary mock: TanStack Router is the external routing library; this test controls the current location and link href resolution.
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

import { Breadcrumbs } from "./breadcrumbs";

describe("Breadcrumbs", () => {
  it("uses TanStack typed links for linkable breadcrumb segments", () => {
    routerBoundary.pathname = "/ui/hooks/composed-refs";
    render(<Breadcrumbs />);

    const hooksLink = screen.getByRole("link", { name: "hooks" });
    expect(hooksLink).toHaveAttribute("data-tanstack-link", "true");
    expect(hooksLink).toHaveAttribute("href", "/ui/hooks");
    expect(screen.queryByRole("link", { name: "composed refs" })).not.toBeInTheDocument();
  });

  it("does not render nested interactive controls", () => {
    routerBoundary.pathname = "/ui/hooks/composed-refs";
    const { container } = render(<Breadcrumbs />);

    for (const link of container.querySelectorAll("a")) {
      expect(link.querySelector("button")).toBeNull();
      expect(link.querySelector("a")).toBeNull();
    }
  });
});
