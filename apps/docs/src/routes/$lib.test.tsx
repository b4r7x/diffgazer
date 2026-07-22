// @vitest-environment jsdom

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/** Loader payload for `/ui/getting-started` from the real docs source (path is the fumadocs content key). */
const uiGettingStartedPage = {
  path: "ui/getting-started/index.mdx",
  title: "Getting Started",
  description: "Install `@diffgazer/ui`, wire up your app, and configure the theme.",
  library: "ui" as const,
};

// Boundary mock: TanStack Start server functions cross the server/client boundary.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler:
        () =>
        async ({ data }: { data?: Record<string, unknown> } = {}) => {
          if (data && "routeSlugs" in data && "library" in data) {
            const library = data.library;
            const routeSlugs = data.routeSlugs;
            if (
              library === uiGettingStartedPage.library &&
              Array.isArray(routeSlugs) &&
              routeSlugs.length === 1 &&
              routeSlugs[0] === "getting-started"
            ) {
              return {
                path: uiGettingStartedPage.path,
                title: uiGettingStartedPage.title,
                description: uiGettingStartedPage.description,
                library: uiGettingStartedPage.library,
              };
            }
            return null;
          }
          if (data && "library" in data) {
            return { library: data.library, pageTree: docsPageTree };
          }
          return null;
        },
    };
    return chain;
  },
}));

// Lets a single test mark a known library disabled without disabling the primary
// (a globally disabled primary would loop the redirect target).
const { disabledLibrary } = vi.hoisted(() => ({ disabledLibrary: { id: "" } }));

// Boundary mock: docs library config is file-backed app configuration; this test overrides one config row to cover disabled-library routing.
vi.mock("@/lib/library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/library")>();
  return {
    ...actual,
    getDocsLibraryConfig: (lib: Parameters<typeof actual.getDocsLibraryConfig>[0]) => {
      const config = actual.getDocsLibraryConfig(lib);
      return lib === disabledLibrary.id ? { ...config, enabled: false } : config;
    },
  };
});

function installBrowserMocks() {
  stubMatchMedia({ isDesktop: false });
  Element.prototype.scrollIntoView = () => {};

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

describe("$lib unknown-segment handling", () => {
  beforeEach(() => {
    disabledLibrary.id = "";
    installBrowserMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the not-found state for an unknown library segment without redirecting", async () => {
    const router = renderRoute("/nonsense");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/nonsense");
  });

  it("redirects a known-but-disabled library to the primary library instead of 404ing", async () => {
    disabledLibrary.id = "keys";
    const router = renderRoute("/keys/getting-started");

    await vi.waitFor(() => expect(router.state.location.pathname.startsWith("/ui")).toBe(true));
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
  });

  it("completes an enabled library content route without redirecting or root not-found", async () => {
    const router = renderRoute("/ui/getting-started");

    expect(await screen.findByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/ui/getting-started",
    );

    await vi.waitFor(() => expect(router.state.status).toBe("idle"));
    expect(router.state.location.pathname).toBe("/ui/getting-started");
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
  });
});
