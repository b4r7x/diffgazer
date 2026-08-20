import { KeyboardProvider, useScope } from "@diffgazer/keys";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDialogScope } from "@/hooks/use-dialog-scope";
import { shutdown } from "@/lib/shutdown";
import { GlobalShortcuts } from "./global";

vi.mock("@/lib/shutdown", () => ({
  shutdown: vi.fn().mockResolvedValue({ status: "closed" as const }),
  reportShutdownResult: vi.fn(),
}));

function ScopedDialogPage() {
  useDialogScope("test-dialog");
  return <dialog open>Dialog page</dialog>;
}

// Named like a dialog scope but registered through plain useScope: suppression
// must key on the registration, never on the name.
function ConventionNamedPage() {
  useScope("unregistered-dialog");
  return <dialog open>Convention-named dialog page</dialog>;
}

function createShortcutRouter(initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <KeyboardProvider>
        <GlobalShortcuts />
        <Outlet />
      </KeyboardProvider>
    ),
  });
  const helpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/help",
    component: () => <input aria-label="Help search" />,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <p>Settings page</p>,
  });
  const historyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/history",
    component: () => <p>History page</p>,
  });
  const onboardingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/onboarding",
    component: () => <p>Onboarding page</p>,
  });
  const scopedDialogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dialog",
    component: ScopedDialogPage,
  });
  const unscopedDialogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/unscoped-dialog",
    component: () => <dialog open>Unscoped dialog page</dialog>,
  });
  const conventionNamedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/unregistered-dialog",
    component: ConventionNamedPage,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([
      helpRoute,
      settingsRoute,
      historyRoute,
      onboardingRoute,
      scopedDialogRoute,
      unscopedDialogRoute,
      conventionNamedRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GlobalShortcuts", () => {
  it("navigates from help to settings with s", async () => {
    const user = userEvent.setup();
    const router = createShortcutRouter("/help");
    render(<RouterProvider router={router} />);

    await user.keyboard("s");

    await waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
    expect(screen.getByText("Settings page")).toBeInTheDocument();
  });

  it("ignores global shortcuts from editable controls", async () => {
    const user = userEvent.setup();
    const router = createShortcutRouter("/help");
    render(<RouterProvider router={router} />);

    const search = await screen.findByRole("textbox", { name: "Help search" });
    await user.click(search);
    await user.keyboard("s");

    expect(search).toHaveValue("s");
    expect(router.state.location.pathname).toBe("/help");
  });

  it.each(["/onboarding", "/dialog"])("suppresses section shortcuts on %s", async (path) => {
    const user = userEvent.setup();
    const router = createShortcutRouter(path);
    render(<RouterProvider router={router} />);

    await user.keyboard("s");
    await user.keyboard("h");
    await user.keyboard("{Shift>}?{/Shift}");

    expect(router.state.location.pathname).toBe(path);
  });

  // Suppression is driven by the active keyboard scope, not by an open <dialog>
  // element: every dialog in the app registers its scope through
  // use-dialog-scope while it is open, and one that does not stays reachable by
  // the global shortcuts.
  it("keeps shortcuts live for a dialog that pushes no scope", async () => {
    const user = userEvent.setup();
    const router = createShortcutRouter("/unscoped-dialog");
    render(<RouterProvider router={router} />);

    await user.keyboard("s");

    await waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
  });

  it("keeps shortcuts live for a scope that is only named like a dialog", async () => {
    const user = userEvent.setup();
    const router = createShortcutRouter("/unregistered-dialog");
    render(<RouterProvider router={router} />);

    await user.keyboard("s");

    await waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
  });

  // The section jumps wait for setup, but quit stays available on onboarding,
  // matching the TUI's global shortcuts.
  it("keeps q live on /onboarding", async () => {
    const user = userEvent.setup();
    const router = createShortcutRouter("/onboarding");
    render(<RouterProvider router={router} />);

    await user.keyboard("q");

    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("suppresses shutdown while a dialog scope is active", async () => {
    const user = userEvent.setup();
    const router = createShortcutRouter("/dialog");
    render(<RouterProvider router={router} />);

    await user.keyboard("q");

    expect(shutdown).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/dialog");
  });
});
