import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    await screen.findByText("home ready");

    await testRouter.navigate({ to: "/history" });
    await screen.findByText("guarded ready");

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
    await screen.findByText("home ready");

    await testRouter.navigate({ to: "/history" });
    // The guard resolves at ~150ms; content must appear well before a 500ms hold.
    await screen.findByText("guarded ready", undefined, { timeout: 400 });

    expect(onPendingRender).toHaveBeenCalled();
  });
});
