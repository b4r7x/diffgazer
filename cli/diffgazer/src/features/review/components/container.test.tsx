import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { type ReactElement, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { useNavigation } from "../../../hooks/use-navigation";
import type { Route } from "../../../lib/routes";
import { makeReviewLifecycleBase } from "../../../testing/review-lifecycle-base";
import { CliThemeProvider } from "../../../theme/provider";

const apiMocks = vi.hoisted(() => ({
  clearActiveSession: vi.fn(),
  createReview: vi.fn(),
  useCreateReview: vi.fn(),
  useInit: vi.fn(),
  useReviewLifecycleBase: vi.fn(),
}));

// Boundary mock: core API hooks wrap fetch-backed review lifecycle calls.
vi.mock("@diffgazer/core/api/hooks", () => ({
  useCreateReview: apiMocks.useCreateReview,
  useInit: apiMocks.useInit,
  useReviewLifecycleBase: apiMocks.useReviewLifecycleBase,
  useReviewSessionCache: () => ({
    clearActiveSession: apiMocks.clearActiveSession,
  }),
}));

import { ReviewContainer } from "./container";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  apiMocks.createReview.mockImplementation(async ({ mode = "staged" }: { mode?: ReviewMode }) =>
    makeCreateReviewResponse({ reviewId: "review-123", session: { mode } }),
  );
  apiMocks.useCreateReview.mockReturnValue({ mutateAsync: apiMocks.createReview });
  apiMocks.useInit.mockReturnValue({
    data: {
      config: { provider: "gemini", model: "gemini-2.5-flash" },
      configured: true,
    },
    isLoading: false,
  });
  apiMocks.useReviewLifecycleBase.mockImplementation(({ onComplete }) => {
    useEffect(() => {
      onComplete();
    }, [onComplete]);

    return makeReviewLifecycleBase();
  });
});

const ESC = "\u001b";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function waitUntil(predicate: () => boolean, attempts = 100): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function RouteHarness(): ReactElement {
  const { route } = useNavigation();

  if (route.screen !== "review") {
    return <Text>Home route</Text>;
  }

  return <ReviewContainer mode={route.mode} reviewId={route.reviewId} />;
}

function FooterProbe(): ReactElement {
  const { shortcuts, rightShortcuts } = useFooterData();
  const left = shortcuts.map((shortcut) => `${shortcut.key} ${shortcut.label}`).join(", ");
  const right = rightShortcuts.map((shortcut) => `${shortcut.key} ${shortcut.label}`).join(", ");

  return <Text>{`Footer left: ${left || "none"} right: ${right || "none"}`}</Text>;
}

function renderContainer({
  initialRoute = { screen: "review", reviewId: "review-123", mode: "staged" },
  initialShortcuts = [],
  showFooterProbe = false,
}: {
  initialRoute?: Route;
  initialShortcuts?: Shortcut[];
  showFooterProbe?: boolean;
} = {}) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <TerminalKeyboardProvider>
        <NavigationProvider initialRoute={initialRoute}>
          <FooterProvider initialShortcuts={initialShortcuts}>
            <RouteHarness />
            {showFooterProbe ? <FooterProbe /> : null}
          </FooterProvider>
        </NavigationProvider>
      </TerminalKeyboardProvider>
    </CliThemeProvider>,
  );
}

describe("ReviewContainer", () => {
  test("summary Escape resets and navigates back to home", async () => {
    const { stdin, lastFrame } = renderContainer();

    await flush();
    expect(lastFrame() ?? "").toMatch(/review complete/i);

    stdin.write(ESC);
    await waitUntil(() => (lastFrame() ?? "").includes("Home route"));

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Home route");
    expect(frame).not.toContain("Starting review");
    expect(frame).not.toContain("Loading review");
    expect(apiMocks.clearActiveSession.mock.calls).toContainEqual(["staged", "review-123"]);
    expect(apiMocks.clearActiveSession.mock.calls).not.toContainEqual(["staged"]);
  });

  test("unmounting a running review keeps the active session resumable", () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(makeReviewLifecycleBase({ isStreaming: true }));

    const { unmount } = renderContainer();

    unmount();

    expect(apiMocks.clearActiveSession).not.toHaveBeenCalled();
  });

  test("running Escape returns home without cancelling or clearing the active session", async () => {
    const cancel = vi.fn(async () => null);
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ cancel, isStreaming: true, reviewId: "review-123" }),
    );

    const { stdin, lastFrame } = renderContainer();

    expect(lastFrame() ?? "").toContain("Cancel");
    expect(lastFrame() ?? "").toContain("Back");

    stdin.write(ESC);

    await waitUntil(() => (lastFrame() ?? "").includes("Home route"));
    expect(cancel).not.toHaveBeenCalled();
    expect(apiMocks.clearActiveSession).not.toHaveBeenCalled();
  });

  test("running Cancel still cancels on the server and clears the active session", async () => {
    const cancel = vi.fn(async () => null);
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ cancel, isStreaming: true, reviewId: "review-123" }),
    );

    const { stdin, lastFrame } = renderContainer();

    stdin.write("\r");

    await waitUntil(() => (lastFrame() ?? "").includes("Home route"));
    expect(cancel).toHaveBeenCalledWith("review-123");
    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "review-123");
  });

  test("generic terminal stream errors show Back/Escape instead of streaming Cancel", async () => {
    const cancel = vi.fn(async () => null);
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        cancel,
        error: "stream exploded",
        errorCode: "STREAM_ERROR",
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
      }),
    );

    const { stdin, lastFrame } = renderContainer();

    expect(lastFrame() ?? "").toContain("stream exploded");
    expect(lastFrame() ?? "").toContain("Back");
    expect(lastFrame() ?? "").not.toContain("Cancel");

    stdin.write(ESC);

    await waitUntil(() => (lastFrame() ?? "").includes("Home route"));
    expect(cancel).not.toHaveBeenCalled();
    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "review-123");
  });

  test("remote-cancel terminal states show Back/Escape instead of streaming Cancel", async () => {
    const cancel = vi.fn(async () => null);
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        cancel,
        error: "Review was cancelled remotely.",
        errorCode: ReviewErrorCode.CANCELLED,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
      }),
    );

    const { stdin, lastFrame } = renderContainer();

    expect(lastFrame() ?? "").toContain("Review was cancelled remotely.");
    expect(lastFrame() ?? "").toContain("Back");
    expect(lastFrame() ?? "").not.toContain("Cancel");

    stdin.write(ESC);

    await waitUntil(() => (lastFrame() ?? "").includes("Home route"));
    expect(cancel).not.toHaveBeenCalled();
    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "review-123");
  });

  test("review gates replace stale home footer shortcuts", async () => {
    apiMocks.useInit.mockReturnValue({
      data: {
        config: { provider: null, model: null },
        configured: false,
      },
      isLoading: false,
    });
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ gate: "unconfigured" }),
    );

    const { lastFrame } = renderContainer({
      initialShortcuts: [{ key: "h", label: "Home Menu" }],
      showFooterProbe: true,
    });

    await waitUntil(() => (lastFrame() ?? "").includes("Footer left: Left/Right Actions"));

    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("Home Menu");
    expect(frame).toContain("right: Esc Back");
  });
});
