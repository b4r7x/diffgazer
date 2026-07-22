// @vitest-environment jsdom

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageTree } from "@/lib/page-tree";
import { stubMatchMedia } from "@/testing/match-media";
import { routeTree } from "../routeTree.gen";

const docsPageTree: PageTree = {
  name: "UI",
  children: [
    { type: "separator", name: "Getting Started" },
    { type: "page", name: "Overview", url: "/ui/getting-started" },
  ],
};

const serverBoundary = vi.hoisted(() => ({ failHome: false }));

// Stubs the TanStack Start server-fn boundary; a null loader result = page absent from source (404).
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler:
        () =>
        async ({ data }: { data?: Record<string, unknown> } = {}) => {
          if (!data && serverBoundary.failHome) {
            throw new Error("Home render failed");
          }
          if (data && ("slug" in data || "routeSlugs" in data)) {
            return null;
          }
          if (data && "library" in data) {
            return { library: data.library, pageTree: docsPageTree };
          }
          return { libraries: [] };
        },
    };
    return chain;
  },
}));

function installBrowserMocks() {
  stubMatchMedia({ isDesktop: false });

  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
}

function renderRoute(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  render(<RouterProvider router={router} />);
  return router;
}

describe("docs route not-found handling", () => {
  beforeEach(() => {
    serverBoundary.failHome = false;
    installBrowserMocks();
  });

  it("renders the docs not-found state for invalid docs slugs instead of the root error boundary", async () => {
    renderRoute("/ui/BadSlug");

    expect(
      await screen.findByRole("heading", { name: "Documentation page not found" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
  });

  it("renders the docs not-found state for a lowercase page missing from the source", async () => {
    const user = userEvent.setup();
    const router = renderRoute("/ui/missing-page");

    expect(
      await screen.findByRole("heading", { name: "Documentation page not found" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).queryByText("prev/next")).not.toBeInTheDocument();
    expect(within(footer).queryByText("move")).not.toBeInTheDocument();
    expect(within(footer).getByText("search")).toBeInTheDocument();

    await user.keyboard("pn");
    expect(router.state.location.pathname).toBe("/ui/missing-page");

    await user.keyboard("/");
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("renders the root not-found inside a single chrome when a loader throws notFound()", async () => {
    renderRoute("/privacy");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Skip to content" })).toHaveLength(1);
    expect(screen.getAllByRole("navigation", { name: "Primary" })).toHaveLength(1);
  });

  it("labels the render-error action as TRY_AGAIN and recovers through its retry control", async () => {
    const user = userEvent.setup();
    serverBoundary.failHome = true;
    renderRoute("/");

    await screen.findByRole("heading", { name: "Something went wrong" });
    expect(screen.getByText("TRY_AGAIN")).toBeVisible();

    serverBoundary.failHome = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Documentation" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).not.toBeInTheDocument();
  });
});
