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
import { GlobalShortcuts } from "./global";

vi.mock("@/features/home/lib/shutdown", () => ({ shutdown: vi.fn() }));

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
  const dialogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dialog",
    component: ScopedDialogPage,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([helpRoute, settingsRoute, onboardingRoute, dialogRoute]),
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

  it.each(["/onboarding", "/dialog"])("suppresses shortcuts on %s", async (path) => {
    const user = userEvent.setup();
    const router = createShortcutRouter(path);
    render(<RouterProvider router={router} />);

    await user.keyboard("s");

    expect(router.state.location.pathname).toBe(path);
  });
});
