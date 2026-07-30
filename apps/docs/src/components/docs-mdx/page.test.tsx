// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
import { SearchProvider } from "@/hooks/search-context";
import type { PageTree } from "@/lib/page-tree";
import { stubMatchMedia } from "@/testing/match-media";
import { MdxDocsPage } from "./page";

const originalLocation = globalThis.location;

// Boundary mock: @tanstack/react-start server functions cross the server/client boundary
// and cannot run at import time in the test environment.
vi.mock("@tanstack/react-start", () => {
  const chain = {
    inputValidator: () => chain,
    handler: () => async () => null,
  };
  return { createServerFn: () => chain };
});

// Boundary mock: pager links and layout chrome use router context without a live router.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  const { ScriptOnceMock } = await import("@/testing/router-mock");
  return {
    ...actual,
    ScriptOnce: ScriptOnceMock,
    useNavigate: () => () => {},
    useRouter: () => ({ subscribe: () => () => {} }),
    useRouterState: ({ select }: { select: (state: object) => unknown }) =>
      select({ isLoading: false, location: { pathname: "/ui/beta" }, status: "idle" }),
    useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
      select({ pathname: "/ui/beta" }),
    Link: ({
      children,
      className,
      rel,
    }: {
      children?: React.ReactNode;
      className?: string;
      rel?: string;
    }) => (
      <a href="/mock" className={className} rel={rel}>
        {children}
      </a>
    ),
  };
});

const tree: PageTree = {
  name: "UI",
  children: [
    { type: "page", name: "Alpha", url: "/ui/alpha" },
    { type: "page", name: "Beta", url: "/ui/beta" },
    { type: "page", name: "Gamma", url: "/ui/gamma" },
  ],
};

describe("MdxDocsPage", () => {
  beforeEach(() => {
    stubMatchMedia({ isDesktop: true });
    Element.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    vi.stubGlobal("location", originalLocation);
  });

  it("keeps the docs shell and pager available when the lazy MDX module rejects", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("location", { reload });
    const RejectedMdx = lazy(async () => {
      throw new Error("failed to load MDX chunk");
    });

    render(
      <KeyboardProvider>
        <MobileNavProvider>
          <SearchProvider>
            <MdxDocsPage
              path="ui/beta.mdx"
              pageUrl="/ui/beta"
              tree={tree}
              library="ui"
              componentData={null}
              hookData={null}
            >
              <RejectedMdx />
            </MdxDocsPage>
          </SearchProvider>
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Documentation page unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Sidebar navigation" })).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-mdx-preload][data-mdx-collection="docs"][data-mdx-path="ui/beta.mdx"]',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Previous: Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next: Gamma/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload page" }));

    expect(reload).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("keeps the desktop TOC rail while MDX content is loading", () => {
    const PendingMdx = lazy(() => new Promise<{ default: () => null }>(() => {}));

    const { container } = render(
      <KeyboardProvider>
        <MobileNavProvider>
          <SearchProvider>
            <MdxDocsPage
              path="ui/beta.mdx"
              pageUrl="/ui/beta"
              tree={tree}
              library="ui"
              componentData={null}
              hookData={null}
            >
              <PendingMdx />
            </MdxDocsPage>
          </SearchProvider>
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading documentation page");
    expect(screen.queryByRole("navigation", { name: "On this page" })).not.toBeInTheDocument();
    expect(container.querySelector('nav[data-slot="toc"][aria-hidden="true"]')).toBeInTheDocument();
  });
});
