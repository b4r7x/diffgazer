// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Boundary mock: @tanstack/react-router is the routing boundary. Link renders an
// anchor whose href is the resolved /$lib or /$lib/$ target so tests can assert
// navigation destinations without a full route tree.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: { lib: string; _splat?: string };
    children: ReactNode;
  } & Record<string, unknown>) => {
    let href = to;
    if (params?.lib) href = href.replace("$lib", params.lib);
    href = href.replace("/$", params?._splat ? `/${params._splat}` : "");
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

import { SearchProvider, useSearchOpen } from "@/lib/search-context";
import type { HomeLibrary } from "../data";
import { HomeView } from "./view";

const LIBRARIES: HomeLibrary[] = [
  {
    id: "ui",
    displayName: "@diffgazer/ui",
    sections: [
      {
        name: "Getting Started",
        splat: "getting-started/installation",
        count: 5,
      },
      { name: "Components", splat: "components/button", count: 47 },
      { name: "Hooks", splat: "hooks/listbox", count: 11 },
      { name: "Theme", splat: "theme/tokens", count: 1 },
    ],
  },
  {
    id: "keys",
    displayName: "@diffgazer/keys",
    sections: [
      {
        name: "Getting Started",
        splat: "getting-started/installation",
        count: 3,
      },
      { name: "Hooks", splat: "hooks/use-key", count: 9 },
      { name: "API", splat: "api/keyboard-provider", count: 4 },
    ],
  },
];

function SearchProbe() {
  const { open } = useSearchOpen();
  return <span data-testid="search-state">{open ? "open" : "closed"}</span>;
}

function renderHome() {
  return render(
    <SearchProvider>
      <SearchProbe />
      <HomeView libraries={LIBRARIES} />
    </SearchProvider>,
  );
}

afterEach(cleanup);

describe("HomeView", () => {
  it("exposes an accessible Documentation heading", () => {
    renderHome();

    expect(screen.getByRole("heading", { level: 1, name: "Documentation" })).toBeInTheDocument();
  });

  it("opens search when the search affordance is clicked", () => {
    renderHome();

    expect(screen.getByTestId("search-state")).toHaveTextContent("closed");

    fireEvent.click(screen.getByRole("button", { name: /search documentation/i }));

    expect(screen.getByTestId("search-state")).toHaveTextContent("open");
  });

  it("links the three documentation areas to their roots", () => {
    renderHome();

    const areas = screen.getByRole("region", { name: "Documentation areas" });

    expect(within(areas).getByRole("link", { name: /^diffgazer AI code review/i })).toHaveAttribute(
      "href",
      "/app",
    );

    expect(within(areas).getByRole("link", { name: /^@diffgazer\/ui/i })).toHaveAttribute(
      "href",
      "/ui",
    );

    expect(within(areas).getByRole("link", { name: /^@diffgazer\/keys/i })).toHaveAttribute(
      "href",
      "/keys",
    );
  });

  it("surfaces the real component and hook counts on the area cards", () => {
    renderHome();

    const areas = screen.getByRole("region", { name: "Documentation areas" });
    expect(within(areas).getByText(/browse 47 components/i)).toBeInTheDocument();
    expect(within(areas).getByText(/browse 9 hooks/i)).toBeInTheDocument();
  });

  it("titles the browse section with an accurate, non-recency heading", () => {
    renderHome();

    expect(screen.getByRole("heading", { level: 2, name: "Browse the docs" })).toBeInTheDocument();
    expect(screen.queryByText(/recent updates/i)).not.toBeInTheDocument();
  });

  it("lists every library section as a navigable Browse row", () => {
    renderHome();

    const browse = screen.getByRole("navigation", {
      name: "Browse documentation",
    });

    const componentsRow = within(browse).getByRole("link", {
      name: /components/i,
    });
    expect(componentsRow).toHaveAttribute("href", "/ui/components/button");

    const keysApiRow = within(browse).getByRole("link", { name: /api/i });
    expect(keysApiRow).toHaveAttribute("href", "/keys/api/keyboard-provider");

    // One row per library section across both libraries (4 + 3).
    expect(within(browse).getAllByRole("link")).toHaveLength(7);
    for (const link of within(browse).getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/(ui|keys)\/.+/);
    }
  });

  it("exposes available external links in the footer", () => {
    renderHome();

    const footerNav = screen.getByRole("navigation", {
      name: "External links",
    });
    expect(within(footerNav).getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/b4r7x/diffgazer",
    );
    expect(within(footerNav).queryByRole("link", { name: "NPM" })).not.toBeInTheDocument();
    expect(within(footerNav).getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/ui");
  });
});
