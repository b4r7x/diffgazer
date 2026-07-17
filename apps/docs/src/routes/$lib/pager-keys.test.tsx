// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
import type { PageTree } from "@/lib/page-tree";
import { stubMatchMedia } from "@/testing/match-media";
import SelectTagsExample from "../../../../../libs/ui/registry/examples/select/select-tags";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
const mdxLoader = vi.hoisted(() => ({ useContent: vi.fn() }));
const originalLocation = globalThis.location;

vi.mock("fumadocs-mdx:collections/browser", () => ({
  default: {
    docs: {
      createClientLoader: () => ({
        useContent: mdxLoader.useContent,
      }),
    },
  },
}));

// Boundary mock: TanStack Start server functions cross the server/client boundary
// and cannot run at import time in the test environment.
vi.mock("@tanstack/react-start", () => {
  const chain = {
    inputValidator: () => chain,
    handler: () => async () => null,
  };
  return { createServerFn: () => chain };
});

// Boundary mock: the pager renders router `Link`s and navigates via `useNavigate`;
// stub both so the footer can be exercised without a live router.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => navigate,
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
      children?: ReactNode;
      className?: string;
      rel?: string;
    }) => (
      <a href="/mock" className={className} rel={rel}>
        {children}
      </a>
    ),
  };
});

const { DocsFooterPager, MdxDocsPage } = await import("./$");

const tree: PageTree = {
  name: "UI",
  children: [
    { type: "page", name: "Alpha", url: "/ui/alpha" },
    { type: "page", name: "Beta", url: "/ui/beta" },
    { type: "page", name: "Gamma", url: "/ui/gamma" },
  ],
};

function renderPager(pageUrl: string) {
  return render(
    <KeyboardProvider>
      <DocsFooterPager pageUrl={pageUrl} tree={tree} library="ui" />
    </KeyboardProvider>,
  );
}

function PagerWithSelectTags() {
  return (
    <KeyboardProvider>
      <SelectTagsExample />
      <div role="menu">
        <div role="menuitem" tabIndex={0}>
          Custom control
        </div>
      </div>
      <DocsFooterPager pageUrl="/ui/beta" tree={tree} library="ui" />
    </KeyboardProvider>
  );
}

describe("DocsFooterPager keyboard navigation", () => {
  beforeEach(() => {
    stubMatchMedia({ isDesktop: true });
    Element.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    navigate.mockClear();
    mdxLoader.useContent.mockReset();
    vi.stubGlobal("location", originalLocation);
  });

  it("navigates to the next page on 'n' and the previous page on 'p'", async () => {
    const user = userEvent.setup();
    renderPager("/ui/beta");

    await user.keyboard("n");
    expect(navigate).toHaveBeenCalledWith({
      to: "/$lib/$",
      params: { lib: "ui", _splat: "gamma" },
    });

    navigate.mockClear();

    await user.keyboard("p");
    expect(navigate).toHaveBeenCalledWith({
      to: "/$lib/$",
      params: { lib: "ui", _splat: "alpha" },
    });
  });

  it("is a no-op at the boundaries with no neighbor to move to", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPager("/ui/alpha");

    await user.keyboard("p");
    expect(navigate).not.toHaveBeenCalled();

    unmount();
    renderPager("/ui/gamma");

    await user.keyboard("n");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("leaves p to SelectTags typeahead while p still navigates outside controls", async () => {
    const user = userEvent.setup();
    render(<PagerWithSelectTags />);

    const trigger = screen.getByRole("combobox", { name: "Languages" });
    await user.click(trigger);
    await user.keyboard("p");

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Python" }).id,
    );

    screen.getByRole("listbox").blur();
    expect(document.activeElement).toBe(document.body);
    await user.keyboard("p");

    expect(navigate).toHaveBeenCalledWith({
      to: "/$lib/$",
      params: { lib: "ui", _splat: "alpha" },
    });
  });

  it("does not navigate from a custom interactive role", async () => {
    const user = userEvent.setup();
    render(<PagerWithSelectTags />);

    screen.getByRole("menuitem", { name: "Custom control" }).focus();
    await user.keyboard("p");

    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps the docs shell and pager available when the lazy MDX module rejects", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("location", { reload });
    const RejectedMdx = lazy(async () => {
      throw new Error("failed to load MDX chunk");
    });
    mdxLoader.useContent.mockImplementation(() => <RejectedMdx />);

    render(
      <KeyboardProvider>
        <MobileNavProvider>
          <MdxDocsPage
            path="ui/beta.mdx"
            pageUrl="/ui/beta"
            tree={tree}
            library="ui"
            componentData={null}
            hookData={null}
          />
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Documentation page unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Sidebar navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Previous: Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next: Gamma/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload page" }));

    expect(reload).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
