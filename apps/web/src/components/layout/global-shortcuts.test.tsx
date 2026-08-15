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
import { shutdown } from "@/lib/shutdown";
import { GlobalShortcuts } from "./global";

vi.mock("@/lib/shutdown", () => ({
  shutdown: vi.fn().mockResolvedValue({ status: "closed" as const }),
  reportShutdownResult: vi.fn(),
}));

function ScopedDialogPage() {
  useScope("test-dialog");
  return <dialog open>Dialog page</dialog>;
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
  return createRouter({
    routeTree: rootRoute.addChildren([
      helpRoute,
      settingsRoute,
      onboardingRoute,
      scopedDialogRoute,
      unscopedDialogRoute,
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

  it.each([
    "/onboarding",
    "/dialog",
  ])("suppresses shortcuts on scoped dialog routes %s", async (path) => {
    const user = userEvent.setup();
    const router = createShortcutRouter(path);
    render(<RouterProvider router={router} />);

    await user.keyboard("s");

    expect(router.state.location.pathname).toBe(path);
  });

  // Suppression is driven by the active keyboard scope, not by an open <dialog>
  // element: every dialog in the app pushes a `-dialog` scope while it is open,
  // and one that does not stays reachable by the global shortcuts.
  it("keeps shortcuts live for a dialog that pushes no scope", async () => {
    const user = userEvent.setup();
    const router = createShortcutRouter("/unscoped-dialog");
    render(<RouterProvider router={router} />);

    await user.keyboard("s");

    await waitFor(() => expect(router.state.location.pathname).toBe("/settings"));
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
