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

  function renderRootRecovery({
    error = new Error("root failure"),
    reloadDocument = vi.fn(),
    navigateHome = vi.fn(),
  }: {
    error?: Error;
    reloadDocument?: () => void;
    navigateHome?: () => void;
  } = {}) {
    // No provider wrapper on purpose: the root error slot replaces the layout
    // that mounts KeyboardProvider, so the gate must bring its own.
    return render(
      <RouteRecoveryPage
        error={error}
        clearFooter={false}
        reloadDocument={reloadDocument}
        navigateHome={navigateHome}
        reset={() => {}}
        info={{ componentStack: "" }}
      />,
    );
  }

  it("announces the root crash without ever rendering the raw error", () => {
    renderRootRecovery({ error: new Error("secret provider token leaked") });

    expect(screen.getByRole("alert")).toHaveTextContent("render aborted");
    expect(screen.getByRole("heading", { name: /render aborted/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Error" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy report/i })).toBeInTheDocument();
    expect(screen.queryByText(/secret provider token leaked/)).not.toBeInTheDocument();
  });

  it("seats the session chip in the wordmark band on desktop and announces it once", () => {
    renderRootRecovery();

    // The chip root is the parent of its "interrupted" span.
    const chipRoots = screen
      .getAllByText("interrupted")
      .map((el) => el.parentElement as HTMLElement);
    expect(chipRoots).toHaveLength(2);

    // The desktop chip lives in the band's right grid cell, so containment is
    // checked from the band down — it must hold both the wordmark and one chip.
    const band = document.querySelector('[data-slot="session-band"]') as HTMLElement;
    expect(band).toContainElement(screen.getByRole("img", { name: "diffgazer" }));
    const inBand = chipRoots.filter((chip) => band.contains(chip));
    expect(inBand).toHaveLength(1);

    // jsdom cannot compute media queries; the breakpoint classes ARE the
    // contract that exactly one rendering is in the accessibility tree at a
    // time, so the chip is announced once.
    const bandChip = inBand[0] as HTMLElement;
    const stackedChip = chipRoots.find((chip) => chip !== bandChip) as HTMLElement;
    expect(bandChip.className).toContain("hidden sm:flex");
    expect(stackedChip.parentElement?.className).toContain("sm:hidden");
  });

  it("focuses retry on the root recovery page and retries on r", async () => {
    const user = userEvent.setup();
    const reloadDocument = vi.fn();
    renderRootRecovery({
      error: new RouteModuleImportError(
        new TypeError("Failed to fetch dynamically imported module"),
      ),
      reloadDocument,
    });

    expect(screen.getByRole("button", { name: /retry/i })).toHaveFocus();

    await user.keyboard("r");

    expect(reloadDocument).toHaveBeenCalledOnce();
  });

  it("goes home on h and on Escape at the root, where the router may be dead", async () => {
    const user = userEvent.setup();
    const navigateHome = vi.fn();
    renderRootRecovery({ navigateHome });

    await user.keyboard("h");
    expect(navigateHome).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(navigateHome).toHaveBeenCalledTimes(2);
  });

  it("moves prompt focus with arrows and activates the focused action on Enter", async () => {
    const user = userEvent.setup();
    const navigateHome = vi.fn();
    renderRootRecovery({ navigateHome });

    expect(screen.getByRole("button", { name: /retry/i })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /home/i })).toHaveFocus();
    // Roving tabindex: the toolbar stays a single Tab stop.
    expect(screen.getByRole("button", { name: /home/i })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: /retry/i })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: /copy report/i })).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /copy report/i })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: /home/i })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(navigateHome).toHaveBeenCalledOnce();
  });

  it("copies a redacted report on c, never the raw message", async () => {
    const user = userEvent.setup();
    renderRootRecovery({ error: new Error("boom: token=sk-abcdefgh12345678 leaked") });

    await user.keyboard("c");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument(),
    );
    const report = await window.navigator.clipboard.readText();
    expect(report).toContain("[REDACTED]");
    expect(report).not.toContain("sk-abcdefgh12345678");
    expect(report).toContain("route: /");
  });

  it("shows copy failed when the clipboard write is rejected", async () => {
    const user = userEvent.setup();
    renderRootRecovery();
    vi.spyOn(window.navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));

    await user.keyboard("c");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /copy failed/i })).toBeInTheDocument(),
    );
  });

  it("shows the real route path in the log tail", () => {
    window.history.replaceState(null, "", "/review/8f2c");
    try {
      renderRootRecovery();
      expect(screen.getByRole("log", { name: "log tail" })).toHaveTextContent("/review/8f2c");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("redacts a secret-bearing query string and error name in the log tail and the copied report", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/review/8f2c?access_token=sk-abcdefgh12345678");
    try {
      // err.name is assignable to arbitrary strings, so it goes through the
      // battery like everything else error-derived.
      renderRootRecovery({
        error: Object.assign(new Error("boom"), { name: "token=sk-poisonedname123" }),
      });

      const logTail = screen.getByRole("log", { name: "log tail" });
      expect(logTail).toHaveTextContent("[REDACTED]");
      expect(logTail).not.toHaveTextContent("sk-abcdefgh12345678");
      expect(logTail).not.toHaveTextContent("sk-poisonedname123");

      await user.keyboard("c");
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument(),
      );
      const report = await window.navigator.clipboard.readText();
      expect(report).toContain("route: /review/8f2c?[REDACTED]");
      expect(report).toContain("error: [REDACTED]");
      expect(report).not.toContain("sk-abcdefgh12345678");
      expect(report).not.toContain("sk-poisonedname123");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("gates the blinking prompt cursor behind prefers-reduced-motion", () => {
    // Class presence is the contract here: jsdom cannot compute the media
    // query, and `motion-reduce:animate-none` IS the reduced-motion gate.
    const { container } = renderRootRecovery();
    const cursor = container.querySelector('[data-slot="prompt-cursor"]');
    expect(cursor?.className).toContain("animate-[erb-cursor-blink");
    expect(cursor?.className).toContain("motion-reduce:animate-none");
  });
});
