// @vitest-environment jsdom

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
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

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler:
        () =>
        async ({ data }: { data?: Record<string, unknown> } = {}) => {
          if (data && "slug" in data) {
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
}

describe("docs route not-found handling", () => {
  beforeEach(() => {
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

  it("renders the root not-found inside a single chrome when a loader throws notFound()", async () => {
    renderRoute("/privacy");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Skip to content" })).toHaveLength(1);
    expect(screen.getAllByRole("navigation", { name: "Primary" })).toHaveLength(1);
  });
});
