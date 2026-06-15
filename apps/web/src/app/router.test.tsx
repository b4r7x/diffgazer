import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";
import { router } from "./router";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTestRouter({
  guardDelayMs,
  defaultPendingMinMs,
  onPendingRender,
}: {
  guardDelayMs: number;
  defaultPendingMinMs: number;
  onPendingRender?: () => void;
}) {
  const rootRoute = createRootRoute({ component: Outlet });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>home ready</div>,
  });
  // Uses a path from the production route tree because the Register declaration
  // in router.tsx types `navigate` against the registered router's paths.
  const guardedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/history",
    component: () => <div>guarded ready</div>,
    beforeLoad: () => delay(guardDelayMs),
  });

  return createRouter({
    routeTree: rootRoute.addChildren([homeRoute, guardedRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPendingComponent: () => {
      onPendingRender?.();
      return <RouteLoadingFallback />;
    },
    defaultPendingMs: 100,
    defaultPendingMinMs,
  });
}

describe("router pending behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("configures the anti-flash pending pair", () => {
    expect(router.options.defaultPendingMs).toBe(100);
    expect(router.options.defaultPendingMinMs).toBe(300);
  });

  it("never renders the pending fallback for a fast guarded navigation", async () => {
    const onPendingRender = vi.fn();
    const testRouter = createTestRouter({
      guardDelayMs: 10,
      defaultPendingMinMs: 300,
      onPendingRender,
    });
    render(<RouterProvider router={testRouter} />);
    await act(async () => {
      await testRouter.load();
    });
    expect(screen.getByText("home ready")).toBeInTheDocument();

    const nav = testRouter.navigate({ to: "/history" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await nav;

    expect(screen.getByText("guarded ready")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(onPendingRender).not.toHaveBeenCalled();
  });

  it("shows route content as soon as a slow guard resolves, without an artificial hold", async () => {
    const onPendingRender = vi.fn();
    const testRouter = createTestRouter({
      guardDelayMs: 150,
      defaultPendingMinMs: 0,
      onPendingRender,
    });
    render(<RouterProvider router={testRouter} />);
    await act(async () => {
      await testRouter.load();
    });
    expect(screen.getByText("home ready")).toBeInTheDocument();

    const nav = testRouter.navigate({ to: "/history" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(99);
    });
    expect(onPendingRender).not.toHaveBeenCalled();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(onPendingRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    await nav;

    expect(screen.getByText("guarded ready")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });
});

const EXPECTED_ROUTE_TITLES: Record<string, string> = {
  "/": "Home — Diffgazer",
  "/onboarding": "Setup — Diffgazer",
  "/review/{-$reviewId}": "Review — Diffgazer",
  "/history": "History — Diffgazer",
  "/help": "Help — Diffgazer",
  "/settings/": "Settings — Diffgazer",
  "/settings/theme": "Theme — Diffgazer",
  "/settings/providers": "Providers — Diffgazer",
  "/settings/storage": "Storage — Diffgazer",
  "/settings/agent-execution": "Agent Execution — Diffgazer",
  "/settings/analysis": "Analysis — Diffgazer",
  "/settings/diagnostics": "Diagnostics — Diffgazer",
  "/settings/trust-permissions": "Trust & Permissions — Diffgazer",
};

function titleFromHead(head: unknown): string | undefined {
  if (typeof head !== "function") return undefined;
  const result = (head as () => { meta?: Array<{ title?: string }> })();
  return result.meta?.find((entry) => typeof entry.title === "string")?.title;
}

describe("route document titles", () => {
  it("declares a head title on every one of the 13 leaf routes", () => {
    const titlesByPath: Record<string, string> = {};
    for (const route of Object.values(router.routesById)) {
      const title = titleFromHead(route.options.head);
      if (title) titlesByPath[route.fullPath] = title;
    }

    expect(titlesByPath).toEqual(EXPECTED_ROUTE_TITLES);
  });

  it("gives every titled route a unique title (WCAG 2.4.2)", () => {
    const titles = Object.values(EXPECTED_ROUTE_TITLES);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).toHaveLength(13);
  });

  it("writes the matched route's title to document.title on navigation", async () => {
    // A mirror router carrying the same head() declarations, with HeadContent
    // rendered in the root, proves the title plumbing writes document.title as
    // the user navigates between views.
    const root = createRootRoute({
      component: () => (
        <>
          <HeadContent />
          <Outlet />
        </>
      ),
    });
    const titleRoutes = Object.entries(EXPECTED_ROUTE_TITLES).map(([path, title]) =>
      createRoute({
        getParentRoute: () => root,
        path: path === "/settings/" ? "/settings" : path,
        component: () => <div>{title}</div>,
        head: () => ({ meta: [{ title }] }),
      }),
    );
    const titleRouter = createRouter({
      routeTree: root.addChildren(titleRoutes),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });

    render(<RouterProvider router={titleRouter} />);
    await waitFor(() => expect(document.title).toBe("Home — Diffgazer"));

    await titleRouter.navigate({ to: "/history" });
    await waitFor(() => expect(document.title).toBe("History — Diffgazer"));

    await titleRouter.navigate({ to: "/settings/theme" });
    await waitFor(() => expect(document.title).toBe("Theme — Diffgazer"));
  });
});
