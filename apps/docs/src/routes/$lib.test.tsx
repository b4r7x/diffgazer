// @vitest-environment jsdom

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

const routeTestFiles = ["$lib.test.tsx", "pager-keys.test.tsx", "docs-not-found-route.test.tsx"];
const ROUTE_GENERATOR_TIMEOUT_MS = 30_000;

function expectSuccessfulSubprocess(result: SpawnSyncReturns<string>): void {
  expect({
    error: result.error?.message,
    signal: result.signal,
    status: result.status,
  }).toEqual({
    error: undefined,
    signal: null,
    status: 0,
  });
}

function withRestoredRouteTree<T>(docsRoot: string, run: () => T): T {
  const routeTreePath = resolve(docsRoot, "src/routeTree.gen.ts");
  const existed = existsSync(routeTreePath);
  const contents = existed ? readFileSync(routeTreePath) : undefined;

  try {
    return run();
  } finally {
    if (contents) {
      writeFileSync(routeTreePath, contents);
    } else {
      rmSync(routeTreePath, { force: true });
    }

    expect(existsSync(routeTreePath)).toBe(existed);
    if (contents) {
      expect(readFileSync(routeTreePath)).toEqual(contents);
    }
  }
}

describe("route tree generator", () => {
  it("excludes colocated route tests without warning", () => {
    const docsRoot = resolve(import.meta.dirname, "../..");
    const result = withRestoredRouteTree(docsRoot, () =>
      spawnSync(process.execPath, [resolve(docsRoot, "scripts/generate-route-tree.mjs")], {
        cwd: docsRoot,
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1" },
        timeout: ROUTE_GENERATOR_TIMEOUT_MS,
      }),
    );

    expectSuccessfulSubprocess(result);
    expect(result.stdout).toContain("[generate-route-tree] Generated src/routeTree.gen.ts");
    expect(result.stderr).not.toContain("Warning: Route file");
    for (const testFile of routeTestFiles) {
      expect(result.stderr).not.toContain(testFile);
    }
  });

  it("configures the production Vite generator to exclude colocated route tests", () => {
    const docsRoot = resolve(import.meta.dirname, "../..");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DOCS_PRERENDER: "0",
      NO_COLOR: "1",
    };
    delete env.VITEST;
    const result = withRestoredRouteTree(docsRoot, () =>
      spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          "import { resolveConfig } from 'vite'; await resolveConfig({ configFile: 'vite.config.ts' }, 'build'); console.log('[vite-config] resolved');",
        ],
        {
          cwd: docsRoot,
          encoding: "utf8",
          env,
          timeout: ROUTE_GENERATOR_TIMEOUT_MS,
        },
      ),
    );

    expectSuccessfulSubprocess(result);
    expect(result.stdout).toContain("[vite-config] resolved");
    expect(result.stderr).not.toContain("Warning: Route file");
    for (const testFile of routeTestFiles) {
      expect(result.stderr).not.toContain(testFile);
    }
  });
});

// Boundary mock: TanStack Start server functions cross the server/client boundary.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler:
        () =>
        async ({ data }: { data?: Record<string, unknown> } = {}) => {
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

  it("renders an enabled library shell without a not-found state", async () => {
    const router = renderRoute("/ui/getting-started");

    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
    expect(router.state.location.pathname.startsWith("/ui")).toBe(true);
  });
});
