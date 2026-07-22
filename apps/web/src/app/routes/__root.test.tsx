import { FooterProvider, useFooterData, usePageFooter } from "@diffgazer/core/footer";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useLocation,
} from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const retryMock = vi.fn();
const serverState = {
  current: { status: "error", message: "Could not connect" } as {
    status: "checking" | "connected" | "error";
    message?: string;
  },
};

vi.mock("@diffgazer/core/api/hooks", () => ({
  useServerStatus: () => ({ state: serverState.current, retry: retryMock }),
}));

import { LocationAwareRouteErrorBoundary, RootLayout, RouteErrorBoundary } from "./__root";

const PAGE_SHORTCUTS = [{ key: "Enter", label: "Run action" }];
const PAGE_RIGHT_SHORTCUTS = [{ key: "Esc", label: "Back" }];

function FooterPublisher({ shouldThrow = false }: { shouldThrow?: boolean }) {
  usePageFooter({ shortcuts: PAGE_SHORTCUTS, rightShortcuts: PAGE_RIGHT_SHORTCUTS });
  if (shouldThrow) throw new Error("broken page");
  return <div>page with footer</div>;
}

function FooterStateView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <output aria-label="Footer state">{JSON.stringify({ shortcuts, rightShortcuts })}</output>;
}

describe("RootLayout retry wiring", () => {
  afterEach(() => {
    cleanup();
    retryMock.mockReset();
    serverState.current = { status: "error", message: "Could not connect" };
  });

  it("survives a rejected retry without unhandled rejection while keeping disconnected UI", async () => {
    const user = userEvent.setup();
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      unhandledRejections.push(event.reason);
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    retryMock.mockRejectedValue(new Error("still disconnected"));

    render(<RootLayout />);

    expect(screen.getByRole("heading", { name: /server disconnected/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /retry connection/i }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(unhandledRejections).toEqual([]);
    expect(screen.getByRole("heading", { name: /server disconnected/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry connection/i })).toBeInTheDocument();

    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  });
});

describe("RouteErrorBoundary recovery", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.unstubAllEnvs();
    cleanup();
  });

  function Thrower({ shouldThrow }: { shouldThrow: () => boolean }) {
    if (shouldThrow()) throw new Error("secret provider token leaked");
    return <div>route content</div>;
  }

  it("announces the failure with alert semantics instead of exposing a full reload", () => {
    render(
      <RouteErrorBoundary onReset={vi.fn()} onReload={vi.fn()}>
        <Thrower shouldThrow={() => true} />
      </RouteErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("hides raw error detail in production and shows it only in dev", () => {
    vi.stubEnv("DEV", false);
    const { unmount } = render(
      <RouteErrorBoundary onReset={vi.fn()} onReload={vi.fn()}>
        <Thrower shouldThrow={() => true} />
      </RouteErrorBoundary>,
    );
    expect(screen.queryByText("secret provider token leaked")).not.toBeInTheDocument();
    unmount();

    vi.stubEnv("DEV", true);
    render(
      <RouteErrorBoundary onReset={vi.fn()} onReload={vi.fn()}>
        <Thrower shouldThrow={() => true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("secret provider token leaked")).toBeInTheDocument();
  });

  it("resets the route and re-renders children on retry without reloading the page", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    let thrown = true;

    render(
      <RouteErrorBoundary onReset={onReset} onReload={vi.fn()}>
        <Thrower shouldThrow={() => thrown} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    thrown = false;
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("route content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("recovers on navigation to a healthy location without manual retry", async () => {
    function RouterDrivenContent() {
      const pathname = useLocation({ select: (location) => location.pathname });
      if (pathname === "/history") throw new Error("broken route");
      return <div>healthy route content</div>;
    }

    const rootRoute = createRootRoute({
      component: () => (
        <FooterProvider initialShortcuts={[]}>
          <LocationAwareRouteErrorBoundary onReset={vi.fn()} onReload={vi.fn()}>
            <RouterDrivenContent />
          </LocationAwareRouteErrorBoundary>
        </FooterProvider>
      ),
    });
    const throwingRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/history",
      component: () => null,
    });
    const healthyRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/help",
      component: () => <div>healthy route content</div>,
    });
    const testRouter = createRouter({
      routeTree: rootRoute.addChildren([throwingRoute, healthyRoute]),
      history: createMemoryHistory({ initialEntries: ["/help"] }),
    });

    render(<RouterProvider router={testRouter} />);
    await waitFor(() => expect(screen.getByText("healthy route content")).toBeInTheDocument());

    await act(async () => {
      await testRouter.navigate({ to: "/history" });
    });
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await act(async () => {
      await testRouter.navigate({ to: "/help" });
    });

    expect(testRouter.state.location.pathname).toBe("/help");
    await waitFor(() => expect(screen.getByText("healthy route content")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears stale page shortcuts after the populated page throws", async () => {
    function View({ shouldThrow }: { shouldThrow: boolean }) {
      return (
        <FooterProvider initialShortcuts={[]}>
          <FooterStateView />
          <RouteErrorBoundary onReset={vi.fn()} onReload={vi.fn()} clearFooter>
            <FooterPublisher shouldThrow={shouldThrow} />
          </RouteErrorBoundary>
        </FooterProvider>
      );
    }

    const { rerender } = render(<View shouldThrow={false} />);
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Footer state" })).toHaveTextContent("Run action"),
    );

    rerender(<View shouldThrow />);

    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Footer state" })).toHaveTextContent(
        '{"shortcuts":[],"rightShortcuts":[]}',
      ),
    );
  });
});
