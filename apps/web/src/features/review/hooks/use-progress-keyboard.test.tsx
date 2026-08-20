import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
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
import { type ReactNode, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalShortcuts } from "@/components/layout/global";
import { StreamingReviewProvider } from "@/components/layout/streaming-review";
import { shutdown } from "@/lib/shutdown";
import { useReviewProgressKeyboard } from "./use-progress-keyboard";

vi.mock("@/lib/shutdown", () => ({
  shutdown: vi.fn().mockResolvedValue({ status: "closed" as const }),
  reportShutdownResult: vi.fn(),
}));

interface ProgressScreenProps {
  onCancel?: () => void;
  cancelDisabled?: boolean;
  hasError?: boolean;
}

function ProgressScreen({
  onCancel,
  cancelDisabled = false,
  hasError = false,
}: ProgressScreenProps) {
  const { progressPaneRef, progressScrollRef, agentFilterRef, logContentRef } =
    useReviewProgressKeyboard({ onCancel, cancelDisabled, hasError });
  return (
    <section ref={progressPaneRef} aria-label="Progress">
      <div ref={progressScrollRef} tabIndex={-1} />
      <div ref={agentFilterRef} />
      <div ref={logContentRef} />
    </section>
  );
}

/** Stand-in for the shell: GlobalShortcuts reads the cancel the screen parks here. */
function ShellHarness({ children }: { children: ReactNode }) {
  const streamingReviewCancel = useRef<(() => void) | null>(null);
  return (
    <FooterProvider>
      <KeyboardProvider>
        <StreamingReviewProvider value={streamingReviewCancel}>
          <GlobalShortcuts />
          {children}
        </StreamingReviewProvider>
      </KeyboardProvider>
    </FooterProvider>
  );
}

function createProgressRouter(props: ProgressScreenProps) {
  const rootRoute = createRootRoute({
    component: () => (
      <ShellHarness>
        <Outlet />
      </ShellHarness>
    ),
  });
  const progressRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <ProgressScreen {...props} />,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <p>Settings page</p>,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([progressRoute, settingsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

// The global q handler always wins the keys dispatch on this screen: it
// re-registers under the active scope after the screen's scope push flushes, so
// it is the newest handler. Cancelling therefore goes through the shell's
// streaming-cancel ref the screen fills, mirroring the TUI's quit interception,
// and these tests pin the whole grammar end to end.
describe("useReviewProgressKeyboard q semantics", () => {
  it("cancels the streaming run on q instead of shutting the app down", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const router = createProgressRouter({ onCancel });
    render(<RouterProvider router={router} />);

    await user.keyboard("q");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(shutdown).not.toHaveBeenCalled();
  });

  it("swallows q while a cancel is pending instead of falling through to shutdown", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const router = createProgressRouter({ onCancel, cancelDisabled: true });
    render(<RouterProvider router={router} />);

    await user.keyboard("q");

    expect(onCancel).not.toHaveBeenCalled();
    expect(shutdown).not.toHaveBeenCalled();
  });

  it("lets q shut the app down again after the failed run stops streaming", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const router = createProgressRouter({ onCancel, hasError: true });
    render(<RouterProvider router={router} />);

    await user.keyboard("q");

    expect(onCancel).not.toHaveBeenCalled();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("releases q back to shutdown after leaving the streaming screen", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const router = createProgressRouter({ onCancel });
    render(<RouterProvider router={router} />);

    await user.keyboard("s");
    await waitFor(() => expect(screen.getByText("Settings page")).toBeInTheDocument());

    await user.keyboard("q");

    expect(onCancel).not.toHaveBeenCalled();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
