import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { act, type ReactElement, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { useNavigation } from "../../../hooks/use-navigation";
import type { Route } from "../../../lib/routes";
import { makeReviewLifecycleBase } from "../../../testing/review-lifecycle-base";
import { waitUntil } from "../../../testing/wait-until";
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

vi.mock("../../../components/layout/global", () => ({
  getContentZoneRows: (rows: number) => Math.max(rows - 4, 0),
  useContentZone: () => ({ columns: 100, rows: 30, contentColumns: 100, contentRows: 26 }),
}));

import { ReviewContainer } from "./container";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
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
      setup: {
        hasSecretsStorage: true,
        hasProvider: true,
        hasModel: true,
        hasTrust: true,
        isConfigured: true,
        isReady: true,
        missing: [],
      },
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

function RouteHarness(): ReactElement {
  const { route } = useNavigation();

  if (route.screen !== "review") {
    return <Text>{route.screen === "home" ? "Home route" : `Route: ${route.screen}`}</Text>;
  }

  return (
    <ReviewContainer
      mode={route.mode}
      reviewId={route.reviewId}
      allowResumeWithoutSetup={route.live}
    />
  );
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
  test("shows live orchestrator lens failures and filtered issue counts in the immediate summary", async () => {
    apiMocks.useReviewLifecycleBase.mockImplementation(({ onComplete }) => {
      useEffect(() => {
        onComplete();
      }, [onComplete]);

      return makeReviewLifecycleBase({
        events: [
          {
            type: "orchestrator_complete",
            totalIssues: 1,
            filesAnalyzed: 1,
            lensStats: [
              { lensId: "correctness", issueCount: 1, status: "success" },
              { lensId: "tests", issueCount: 1, status: "success" },
              {
                lensId: "security",
                issueCount: 0,
                status: "failed",
                errorCode: "PROVIDER_ERROR",
              },
            ],
            droppedDuplicates: 1,
            droppedBelowThreshold: 2,
            minSeverity: "medium",
            timestamp: "2026-01-01T00:00:05.000Z",
          },
        ],
      });
    });

    const { lastFrame } = renderContainer();
    await flush();
    const summary = lastFrame() ?? "";

    expect(summary).toContain("Security");
    expect(summary).toContain("failed (PROVIDER_ERROR)");
    expect(summary).toContain("1 duplicate issue collapsed across lenses (2 → 1 issue)");
    expect(summary).toContain("2 below-threshold issues hidden (threshold: medium)");
  });

  test("uses one completion timestamp for progress and summary across the completion delay", () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const completedAt = new Date("2026-01-01T00:00:05.000Z");
    vi.setSystemTime(completedAt);
    let isCompleting = true;
    let finishCompletion = () => {};

    apiMocks.useReviewLifecycleBase.mockImplementation(({ onComplete }) => {
      finishCompletion = () => {
        isCompleting = false;
        onComplete();
      };
      return makeReviewLifecycleBase({ isCompleting, startedAt, completedAt });
    });

    const { lastFrame } = renderContainer();

    expect(lastFrame() ?? "").toContain("Elapsed: 00:05");

    act(() => {
      vi.advanceTimersByTime(2300);
      finishCompletion();
    });

    const summary = lastFrame() ?? "";
    expect(summary).toMatch(/Review Complete/i);
    expect(summary).toContain("Duration: 5.0s");
  });

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

  test("running c cancels on the server while Enter remains inert", async () => {
    const cancel = vi.fn(async () => null);
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ cancel, isStreaming: true, reviewId: "review-123" }),
    );

    const { stdin, lastFrame } = renderContainer();

    stdin.write("\r");
    await flush();
    expect(cancel).not.toHaveBeenCalled();

    stdin.write("c");

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

  test("a reducer-stopped stream no longer exposes Cancel", () => {
    const cancel = vi.fn(async () => null);
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        cancel,
        error: "Review issues failed",
        isStreaming: false,
        reviewId: "review-123",
      }),
    );

    const { lastFrame } = renderContainer();

    expect(lastFrame() ?? "").toContain("Review issues failed");
    expect(lastFrame() ?? "").not.toContain("Cancel");
    expect(cancel).not.toHaveBeenCalled();
  });

  test("review gates replace stale home footer shortcuts", async () => {
    apiMocks.useInit.mockReturnValue({
      data: {
        config: { provider: null, model: null },
        configured: false,
        setup: {
          hasSecretsStorage: true,
          hasProvider: false,
          hasModel: false,
          hasTrust: true,
          isConfigured: false,
          isReady: false,
          missing: ["provider", "model"],
        },
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
    expect(frame).toContain("API Key Required");
    expect(frame).not.toContain("Model Required");
  });

  test("Switch Mode from an unconfigured resumed no-diff review opens provider setup without resetting first", async () => {
    apiMocks.useInit.mockReturnValue({
      data: {
        config: { provider: null, model: null },
        configured: false,
        setup: {
          hasSecretsStorage: true,
          hasProvider: false,
          hasModel: false,
          hasTrust: true,
          isConfigured: false,
          isReady: false,
          missing: ["provider", "model"],
        },
      },
      isLoading: false,
    });
    const lifecycle = makeReviewLifecycleBase({
      gate: "no-diff",
      isNoDiffError: true,
      error: "No changes to review.",
      errorCode: ReviewErrorCode.NO_DIFF,
    });
    apiMocks.useReviewLifecycleBase.mockReturnValue(lifecycle);

    const { stdin, lastFrame } = renderContainer({
      initialRoute: {
        screen: "review",
        reviewId: "review-123",
        mode: "staged",
        live: true,
      },
    });

    expect(lastFrame() ?? "").toContain("No staged changes");
    stdin.write("\r");
    await waitUntil(() => (lastFrame() ?? "").includes("Route: settings/providers"));

    expect(lastFrame() ?? "").toContain("Route: settings/providers");
    expect(apiMocks.createReview).not.toHaveBeenCalled();
    expect(lifecycle.stream.abort).not.toHaveBeenCalled();
    expect(lifecycle.completion.resetCompletion).not.toHaveBeenCalled();
  });

  test("starts only one alternate review while the no-diff action is pending", async () => {
    let releaseCreateReview: (() => void) | undefined;
    apiMocks.createReview.mockImplementationOnce(async ({ mode = "staged" }) => {
      await new Promise<void>((resolve) => {
        releaseCreateReview = resolve;
      });
      return makeCreateReviewResponse({ reviewId: "review-alternate", session: { mode } });
    });
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        gate: "no-diff",
        isNoDiffError: true,
        error: "No changes to review.",
        errorCode: ReviewErrorCode.NO_DIFF,
      }),
    );

    const { stdin } = renderContainer();
    stdin.write("\r");
    stdin.write("\r");
    await flush();

    expect(apiMocks.createReview).toHaveBeenCalledTimes(1);

    releaseCreateReview?.();
    await flush();
  });
});
