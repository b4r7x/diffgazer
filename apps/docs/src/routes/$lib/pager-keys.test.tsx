// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageTree } from "@/lib/page-tree";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

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

const { DocsFooterPager } = await import("./$");

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

describe("DocsFooterPager keyboard navigation", () => {
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
});
