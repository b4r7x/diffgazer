// @vitest-environment jsdom

import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
import type { PageTree } from "@/lib/page-tree";
import { stubMatchMedia } from "@/testing/match-media";
import { DocsNotFoundBlock } from "./docs-not-found";
import { GlobalNotFound } from "./global-not-found";

const routerBoundary = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: "/ui/missing-page",
}));

// Boundary mock: TanStack Router is the external routing library; links need deterministic hrefs in this component test.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, useLocationMock, useRouterStateMock } = await import(
    "@/testing/router-mock"
  );
  return {
    Link: RouterLinkMock,
    ...useLocationMock({
      get pathname() {
        return routerBoundary.pathname;
      },
    }),
    useNavigate: () => routerBoundary.navigate,
    useRouter: () => ({ subscribe: () => () => {} }),
    ...useRouterStateMock({
      get pathname() {
        return routerBoundary.pathname;
      },
    }),
  };
});

// Boundary mock: TanStack Start server functions cross the server/client boundary.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler: () => async () => ({ library: "ui", slugs: [] }),
    };
    return chain;
  },
}));

const TREE: PageTree = {
  name: "ui",
  children: [{ type: "page", name: "Button", url: "/ui/components/button" }],
};

beforeEach(() => {
  routerBoundary.navigate.mockReset();
  routerBoundary.pathname = "/ui/missing-page";
  stubMatchMedia({ isDesktop: true });
  Element.prototype.scrollIntoView = () => {};
});

function renderBlock() {
  return render(
    <KeyboardProvider>
      <MobileNavProvider>
        <DocsNotFoundBlock tree={TREE} library="ui" />
      </MobileNavProvider>
    </KeyboardProvider>,
  );
}

function expectPanelAction(title: string, action: string) {
  const panel = screen.getByRole("heading", { name: title }).closest('[data-slot="panel"]');
  if (!(panel instanceof HTMLElement)) throw new Error("Fault panel not found");

  const actionTerm = within(panel).getByText("ACTION:");
  expect(actionTerm.nextElementSibling).toHaveTextContent(action);
}

describe("DocsNotFoundBlock", () => {
  it("does not nest buttons inside links for recovery actions", () => {
    const { container } = renderBlock();

    expect(screen.getByRole("link", { name: "Go to docs home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toBeInTheDocument();

    for (const link of container.querySelectorAll("a")) {
      expect(link.querySelector("button")).toBeNull();
    }

    expectPanelAction("Documentation page not found", "OPEN_DOCS");
  });

  it("describes the global 404 action as GO_HOME", () => {
    render(<GlobalNotFound />);

    expect(screen.getByRole("link", { name: "GO_HOME" })).toBeInTheDocument();
    expectPanelAction("Page not found", "GO_HOME");
  });
});
