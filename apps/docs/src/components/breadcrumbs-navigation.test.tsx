// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const routerBoundary = vi.hoisted(() => ({
  pathname: "/ui/hooks/composed-refs",
}));

// Boundary mock: TanStack Router is the external routing library; this test controls the current location and link href resolution.
vi.mock("@tanstack/react-router", async () => {
  const { useLocationMock } = await import("@/testing/router-mock");
  return {
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
    ...useLocationMock({
      get pathname() {
        return routerBoundary.pathname;
      },
    }),
  };
});

import type { PageTree } from "@/lib/page-tree";
import { Breadcrumbs } from "./breadcrumbs";

function sectionTree(section: string, pageUrl: string): PageTree {
  return {
    name: "Docs",
    children: [
      { type: "separator", name: section },
      { type: "page", name: "Current page", url: pageUrl },
    ],
  };
}

describe("Breadcrumbs", () => {
  it("uses TanStack typed links for linkable breadcrumb segments", () => {
    routerBoundary.pathname = "/ui/hooks/composed-refs";
    render(<Breadcrumbs tree={sectionTree("Hooks", "/ui/hooks/composed-refs")} />);

    const hooksLink = screen.getByRole("link", { name: "hooks" });
    expect(hooksLink).toHaveAttribute("data-tanstack-link", "true");
    expect(hooksLink).toHaveAttribute("href", "/ui/hooks");
    expect(screen.queryByRole("link", { name: "composed-refs" })).not.toBeInTheDocument();
  });

  it("shows the sidebar taxonomy section, not the url, for flat pages", () => {
    routerBoundary.pathname = "/ui/changelog";
    render(<Breadcrumbs tree={sectionTree("Project", "/ui/changelog")} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveTextContent("ui/project/changelog");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("changelog")).toHaveAttribute("aria-current", "page");
  });

  it("keeps a path within the character budget fully expanded", () => {
    routerBoundary.pathname = "/ui/getting-started/consumption-modes";
    render(
      <Breadcrumbs
        tree={sectionTree("Getting Started", "/ui/getting-started/consumption-modes")}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveTextContent("ui/getting-started/consumption-modes");
    expect(screen.getByText("consumption-modes")).toHaveAttribute("aria-current", "page");
  });

  it("collapses middle segments to an ellipsis when the path exceeds the budget", () => {
    routerBoundary.pathname = "/app/getting-started/your-first-review";
    render(
      <Breadcrumbs
        tree={sectionTree("Getting Started", "/app/getting-started/your-first-review")}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    // textContent includes the sr-only expansion of the collapsed segments;
    // visually the row reads app/…/your-first-review.
    expect(nav).toHaveTextContent("app/…getting-started/your-first-review");
    expect(nav).toHaveAttribute("title", "app/getting-started/your-first-review");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("your-first-review")).toHaveAttribute("aria-current", "page");
  });

  it("does not render nested interactive controls", () => {
    routerBoundary.pathname = "/ui/hooks/composed-refs";
    const { container } = render(
      <Breadcrumbs tree={sectionTree("Hooks", "/ui/hooks/composed-refs")} />,
    );

    for (const link of container.querySelectorAll("a")) {
      expect(link.querySelector("button")).toBeNull();
      expect(link.querySelector("a")).toBeNull();
    }
  });
});
