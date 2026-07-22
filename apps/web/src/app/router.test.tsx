import { FooterProvider } from "@diffgazer/core/footer";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
  Outlet,
  type RouteComponent,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";
import { ConfigProvider } from "@/hooks/use-config";
import { lazyRoute } from "./route-import";
import { router } from "./router";
import {
  ConnectedRootLayout,
  ConnectedRouteOutlet,
  NotFoundPage,
  RouteRecoveryPage,
} from "./routes/__root";

vi.mock("../lib/config-guards", () => ({
  requireConfigured: vi.fn(),
  requireNotConfigured: vi.fn(),
}));

vi.mock("@/features/home/lib/shutdown", () => ({
  shutdown: vi.fn().mockResolvedValue({ status: "closed" as const }),
}));

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
  // Path must exist in the production route tree: Register types navigate against it.
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

  it("holds the pending fallback for the configured minimum after a slow guard resolves", async () => {
    const onPendingRender = vi.fn();
    const testRouter = createTestRouter({
      guardDelayMs: 150,
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
      await vi.advanceTimersByTimeAsync(99);
    });
    expect(onPendingRender).not.toHaveBeenCalled();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    expect(onPendingRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("guarded ready")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await nav;

    expect(screen.getByText("guarded ready")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });
});

describe("route recovery", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  function createRecoveryRouter({
    component,
    loader,
    reloadDocument,
  }: {
    component: RouteComponent;
    loader?: () => Promise<void> | void;
    reloadDocument: () => void;
  }) {
    const rootRoute = createRootRoute({
      component: () => (
        <FooterProvider initialShortcuts={[]}>
          <ConnectedRouteOutlet reloadDocument={reloadDocument} />
        </FooterProvider>
      ),
    });
    const childRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component,
      ...(loader ? { loader } : {}),
    });
    return createRouter({
      routeTree: rootRoute.addChildren([childRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
      defaultErrorComponent: (props) => (
        <RouteRecoveryPage {...props} reloadDocument={reloadDocument} />
      ),
    });
  }

  it("reloads once after a rejected dynamic route import without invalidating its cached payload", async () => {
    const user = userEvent.setup();
    const reloadDocument = vi.fn();
    const BrokenRoute = lazyRoute(() =>
      Promise.reject(new TypeError("Failed to fetch dynamically imported module")),
    );
    const testRouter = createRecoveryRouter({
      component: BrokenRoute,
      reloadDocument,
    });
    const invalidate = vi.spyOn(testRouter, "invalidate");

    render(<RouterProvider router={testRouter} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(reloadDocument).toHaveBeenCalledOnce();
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("invalidates a rejected route loader without reloading", async () => {
    const user = userEvent.setup();
    const reloadDocument = vi.fn();
    const loader = vi.fn(async () => {
      if (loader.mock.calls.length === 1) {
        throw new Error("loader failed");
      }
    });
    const testRouter = createRecoveryRouter({
      component: () => <div>loader recovered</div>,
      loader,
      reloadDocument,
    });
    const invalidate = vi.spyOn(testRouter, "invalidate");

    render(<RouterProvider router={testRouter} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(screen.getByText("loader recovered")).toBeInTheDocument());
    expect(loader).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(reloadDocument).not.toHaveBeenCalled();
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

function productionRouteHead(fullPath: string) {
  const match = Object.values(router.routesById).find(
    (route) => route.fullPath === fullPath && route.options.head,
  );
  const title = titleFromHead(match?.options.head);
  if (!title) {
    throw new Error(`Expected production head metadata for ${fullPath}`);
  }
  return () => ({ meta: [{ title }] });
}

function createConnectedTitleRouter(initialEntries: string[]) {
  const { Wrapper: QueryWrapper } = createTestQueryWrapper({
    api: {
      loadInit: vi.fn().mockResolvedValue({
        config: { provider: "gemini", model: "gemini-2.5-flash" },
        configured: true,
        project: { projectId: "proj-1", path: "/repo", trust: null },
        providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
        settings: {
          agentExecution: "parallel",
          defaultLenses: [],
          defaultProfile: null,
          secretsStorage: null,
          severityThreshold: "low",
          theme: "terminal",
        },
        setup: {
          hasModel: true,
          hasProvider: true,
          hasSecretsStorage: true,
          hasTrust: false,
          isConfigured: true,
          isReady: true,
          missing: [],
        },
      }),
      getProviderStatus: vi
        .fn()
        .mockResolvedValue([{ provider: "gemini", hasApiKey: true, isActive: true }]),
    },
  });

  const rootRoute = createRootRoute({
    component: () => (
      <QueryWrapper>
        <ConfigProvider>
          <KeyboardProvider>
            <ConnectedRootLayout reloadDocument={vi.fn()} />
          </KeyboardProvider>
        </ConfigProvider>
      </QueryWrapper>
    ),
  });

  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>Home page</div>,
    head: productionRouteHead("/"),
  });
  const historyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/history",
    component: () => <div>History page</div>,
    head: productionRouteHead("/history"),
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <Outlet />,
  });
  const settingsThemeRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/theme",
    component: () => <div>Theme page</div>,
    head: productionRouteHead("/settings/theme"),
  });

  return createRouter({
    routeTree: rootRoute.addChildren([
      homeRoute,
      historyRoute,
      settingsRoute.addChildren([settingsThemeRoute]),
    ]),
    history: createMemoryHistory({ initialEntries }),
  });
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

  it("writes the matched route's title to document.title through ConnectedRootLayout", async () => {
    const titleRouter = createConnectedTitleRouter(["/"]);

    render(<RouterProvider router={titleRouter} />);
    await waitFor(() => expect(document.title).toBe("Home — Diffgazer"));
    expect(screen.getByText("Home page")).toBeInTheDocument();

    await titleRouter.navigate({ to: "/history" });
    await waitFor(() => expect(document.title).toBe("History — Diffgazer"));
    expect(screen.getByText("History page")).toBeInTheDocument();

    await titleRouter.navigate({ to: "/settings/theme" });
    await waitFor(() => expect(document.title).toBe("Theme — Diffgazer"));
    expect(screen.getByText("Theme page")).toBeInTheDocument();
  });
});

describe("not-found routing", () => {
  it("wires the app-owned not-found component into the router", () => {
    expect(router.options.defaultNotFoundComponent).toBe(NotFoundPage);
  });

  it("sets the unmatched title and restores the matched title after returning home", async () => {
    const user = userEvent.setup();
    const rootRoute = createRootRoute({
      component: () => (
        <>
          <HeadContent />
          <Outlet />
        </>
      ),
    });
    const homeRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => <div>home ready</div>,
      head: () => ({ meta: [{ title: "Home — Diffgazer" }] }),
    });
    const notFoundRouter = createRouter({
      routeTree: rootRoute.addChildren([homeRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
      defaultNotFoundComponent: NotFoundPage,
    });

    render(<RouterProvider router={notFoundRouter} />);
    await waitFor(() => expect(document.title).toBe("Home — Diffgazer"));

    await act(async () => {
      notFoundRouter.history.push("/stale-bookmark");
      await notFoundRouter.load();
    });
    await waitFor(() => expect(screen.getByText("Page not found")).toBeInTheDocument());
    expect(document.title).toBe("Page not found — Diffgazer");

    const homeLink = screen.getByRole("link", { name: /go home/i });
    expect(homeLink).toHaveAttribute("href", "/");

    await user.click(homeLink);
    await waitFor(() => expect(screen.getByText("home ready")).toBeInTheDocument());
    await waitFor(() => expect(document.title).toBe("Home — Diffgazer"));
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
  });
});

describe("review route id validation", () => {
  async function loadReviewPath(path: string) {
    const testRouter = createRouter({
      routeTree: router.routeTree,
      history: createMemoryHistory({ initialEntries: [path] }),
    });

    await testRouter.load();
    return testRouter;
  }

  it("opens persisted reviews whose RFC UUID is not version 4", async () => {
    const testRouter = await loadReviewPath("/review/6ba7b810-9dad-11d1-80b4-00c04fd430c8");

    expect(testRouter.state.location.pathname).toBe("/review/6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  });

  it("redirects malformed review ids to the home error state", async () => {
    const testRouter = await loadReviewPath("/review/not-a-uuid");

    expect(testRouter.state.location.pathname).toBe("/");
    expect(testRouter.state.location.search).toEqual({ error: "invalid-review-id" });
  });
});
