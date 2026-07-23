// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageTree } from "@/lib/page-tree";
import { stubMatchMedia } from "@/testing/match-media";
import SelectTagsExample from "../../../../../libs/ui/registry/examples/select/select-tags";
import { DocsFooterPager } from "./footer-pager";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

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
});
