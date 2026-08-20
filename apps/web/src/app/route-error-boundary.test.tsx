import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FooterView } from "@/testing/footer-view";
import { RouteOutletBoundary, RouteRecoveryPage } from "./route-error-boundary";
import { RouteModuleImportError } from "./route-import";

describe("RouteRecoveryPage", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.unstubAllEnvs();
    cleanup();
  });

  function ThrowingPage({ shouldThrow }: { shouldThrow: () => boolean }) {
    if (shouldThrow()) throw new Error("secret provider token leaked");
    return <div>route content</div>;
  }

  function createRecoveryRouter({
    reloadDocument = vi.fn(),
  }: {
    reloadDocument?: () => void;
  } = {}) {
    let thrown = true;
    const rootRoute = createRootRoute({
      component: () => (
        <FooterProvider initialShortcuts={[]}>
          <KeyboardProvider>
            <RouteOutletBoundary />
            <FooterView />
          </KeyboardProvider>
        </FooterProvider>
      ),
    });
    const childRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => <ThrowingPage shouldThrow={() => thrown} />,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([childRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
      defaultErrorComponent: (props) => (
        <RouteRecoveryPage {...props} reloadDocument={reloadDocument} />
      ),
    });
    return {
      router,
      releaseThrow: () => {
        thrown = false;
      },
    };
  }

  it("announces the failure with a heading and alert semantics", async () => {
    const { router } = createRecoveryRouter();
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to home/i })).toBeInTheDocument();
  });

  it("advertises Escape as Home only, since that is the one thing it does", async () => {
    const { router } = createRecoveryRouter();
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("hides raw error detail in production", async () => {
    vi.stubEnv("DEV", false);
    const { router } = createRecoveryRouter();
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText("secret provider token leaked")).not.toBeInTheDocument();
  });

  it("shows raw error detail in dev", async () => {
    vi.stubEnv("DEV", true);
    const { router } = createRecoveryRouter();
    render(<RouterProvider router={router} />);
    await waitFor(() =>
      expect(screen.getByText("secret provider token leaked")).toBeInTheDocument(),
    );
  });

  it("invalidates the route and re-renders children on retry without reloading the page", async () => {
    const user = userEvent.setup();
    const reloadDocument = vi.fn();
    const { router, releaseThrow } = createRecoveryRouter({ reloadDocument });
    const invalidate = vi.spyOn(router, "invalidate");

    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    releaseThrow();
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(reloadDocument).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("route content")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reloads once after a rejected dynamic route import", async () => {
    const user = userEvent.setup();
    const reloadDocument = vi.fn();
    const rootRoute = createRootRoute({
      component: () => (
        <FooterProvider initialShortcuts={[]}>
          <KeyboardProvider>
            <RouteOutletBoundary />
            <FooterView />
          </KeyboardProvider>
        </FooterProvider>
      ),
    });
    const childRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => {
        throw new RouteModuleImportError(
          new TypeError("Failed to fetch dynamically imported module"),
        );
      },
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([childRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
      defaultErrorComponent: (props) => (
        <RouteRecoveryPage {...props} reloadDocument={reloadDocument} />
      ),
    });

    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(reloadDocument).toHaveBeenCalledOnce();
  });

  it("renders a minimal root recovery page without footer hooks", () => {
    render(
      <RouteRecoveryPage
        error={new Error("root failure")}
        clearFooter={false}
        reset={() => {}}
        info={{ componentStack: "" }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /go to home/i })).not.toBeInTheDocument();
  });

  it("focuses Try again on the root recovery page and retries on r", async () => {
    const user = userEvent.setup();
    const reloadDocument = vi.fn();
    render(
      <KeyboardProvider>
        <RouteRecoveryPage
          error={
            new RouteModuleImportError(new TypeError("Failed to fetch dynamically imported module"))
          }
          clearFooter={false}
          reloadDocument={reloadDocument}
          reset={() => {}}
          info={{ componentStack: "" }}
        />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("button", { name: /try again/i })).toHaveFocus();
    // The gate renders outside the shell, so the hint beside the button is the
    // only place r is advertised.
    expect(screen.getByText("r")).toBeInTheDocument();

    await user.keyboard("r");

    expect(reloadDocument).toHaveBeenCalledOnce();
  });
});
