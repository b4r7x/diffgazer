// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    if (to === "/$lib" && params?.lib && !params._splat) {
      href = `/${params.lib}`;
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
    select({ pathname: "/" }),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: "/" } }),
}));

import { MobileNavProvider } from "@/lib/mobile-nav-context";
import type { HomeLibrary } from "../data";
import { HomeView } from "./view";

const LIBRARIES: HomeLibrary[] = [
  {
    id: "app",
    displayName: "diffgazer",
    sections: [
      {
        name: "Getting Started",
        splat: "getting-started/installation",
        count: 4,
      },
      { name: "Product", splat: "story", count: 4 },
      { name: "Concepts", splat: "concepts/overview", count: 3 },
      { name: "Web Mode", splat: "web/overview", count: 2 },
      { name: "Terminal UI", splat: "tui/overview", count: 2 },
      { name: "Reference", splat: "reference/overview", count: 5 },
      { name: "Registry CLI", splat: "cli/dgadd", count: 6 },
      { name: "Operations", splat: "operations/overview", count: 2 },
    ],
  },
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
    ],
  },
];

function mockDesktopViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("1024"),
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

function renderHome() {
  return render(
    <MobileNavProvider>
      <HomeView libraries={LIBRARIES} />
    </MobileNavProvider>,
  );
}

afterEach(cleanup);

beforeEach(() => {
  mockDesktopViewport();
});

describe("HomeView", () => {
  it("exposes an accessible Documentation heading", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Documentation" })).toBeInTheDocument();
  });

  it("renders the SYS_INFO status block", () => {
    renderHome();
    expect(screen.getByText("STATUS:")).toBeInTheDocument();
    expect(screen.getByText("OPERATIONAL")).toBeInTheDocument();
    expect(screen.getByText(/REGISTRY:/)).toBeInTheDocument();
  });

  it("lists packages in the modules index table", () => {
    renderHome();

    const modules = screen.getByRole("navigation", { name: "Documentation packages" });
    expect(within(modules).getByRole("link", { name: /^diffgazer\b/i })).toHaveAttribute(
      "href",
      "/app/getting-started/installation",
    );
    expect(within(modules).getByRole("link", { name: /^@diffgazer\/ui\b/i })).toHaveAttribute(
      "href",
      "/ui/getting-started/installation",
    );
    expect(within(modules).getByText("47 Comp")).toBeInTheDocument();
    expect(within(modules).getByText("9 Hooks")).toBeInTheDocument();
  });

  it("renders a tree sidebar with library sections", () => {
    renderHome();

    const sidebar = screen.getByRole("navigation", { name: "Primary" });
    expect(within(sidebar).getByRole("heading", { name: "@diffgazer/ui" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /Components \(47\)/i })).toHaveAttribute(
      "href",
      "/ui/components/button",
    );
  });

});
