import type { GitStatus } from "@diffgazer/core/schemas/git";
import {
  ReviewErrorCode,
  type ReviewMode,
  type ReviewSizeWarning,
} from "@diffgazer/core/schemas/review";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { cleanup } from "ink-testing-library";
import { act, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import {
  ESC,
  makeReadyInitResponse,
  makeUnconfiguredInitResponse,
  type RenderReviewContainerOptions,
  renderReviewContainer,
} from "../testing/container-harness";
import { frameText, stripAnsi } from "../testing/frame-text";
import { makeReviewLifecycleBase } from "../testing/review-lifecycle-base";

const apiMocks = vi.hoisted(() => ({
  clearActiveSession: vi.fn(),
  createReview: vi.fn(),
  saveSettings: vi.fn(async () => {}),
  useCreateReview: vi.fn(),
  useConfigurationInit: vi.fn(),
  useReviewLifecycleBase: vi.fn(),
}));

// Boundary mock: core API hooks wrap fetch-backed review lifecycle calls.
vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useCreateReview: apiMocks.useCreateReview,
    useConfigurationInit: apiMocks.useConfigurationInit,
    useReviewLifecycleBase: apiMocks.useReviewLifecycleBase,
    useReviewSessionCache: () => ({
      clearActiveSession: apiMocks.clearActiveSession,
    }),
  };
});

vi.mock("../../../components/layout/global", () => ({
  getContentZoneRows: (rows: number) => Math.max(rows - 4, 0),
  useContentZone: () => ({ columns: 100, contentColumns: 100, contentRows: 26 }),
}));

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
  apiMocks.useConfigurationInit.mockReturnValue({
    data: makeReadyInitResponse(),
    isLoading: false,
  });
  apiMocks.useReviewLifecycleBase.mockImplementation(({ onComplete }) => {
    useEffect(() => {
      onComplete();
    }, [onComplete]);

    return makeReviewLifecycleBase();
  });
});

function renderContainer(options: RenderReviewContainerOptions = {}) {
  return renderReviewContainer({ api: { saveSettings: apiMocks.saveSettings }, ...options });
}

const STAGED_TWO_FILES: GitStatus = {
  isGitRepo: true,
  branch: "main",
  remoteBranch: null,
  ahead: 0,
  behind: 0,
  files: {
    staged: [
      { path: "src/a.ts", indexStatus: "M", workTreeStatus: " " },
      { path: "src/b.ts", indexStatus: "M", workTreeStatus: " " },
    ],
    unstaged: [],
    untracked: [],
  },
  hasChanges: true,
  conflicted: [],
};

const OVER_WINDOW_ERROR =
  "This diff does not fit gpt-test. It is 1.20MB across 40 files, about 400,000 prompt tokens, against a 128,000-token context window.";

const SIZE_WARNING: ReviewSizeWarning = {
  message: "Large review: 0.60MB across 30 files, about 190,000 prompt tokens.",
  diffBytes: 629_145,
  estimatedInputTokens: 190_000,
  contextTokens: 400_000,
  modelId: "gpt-test",
};

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

    expect(stripAnsi(lastFrame() ?? "")).toContain("Elapsed: 00:05");

    act(() => {
      vi.advanceTimersByTime(2300);
      finishCompletion();
    });

    const summary = lastFrame() ?? "";
    expect(summary).toMatch(/Review Complete/i);
    expect(summary).toContain("Elapsed: 5s");
  });

  test("re-runs the same scope from a clean run's Run Again", async () => {
    apiMocks.useReviewLifecycleBase.mockImplementation(({ onComplete }) => {
      useEffect(() => {
        onComplete();
      }, [onComplete]);

      return makeReviewLifecycleBase({ issues: [] });
    });

    const { stdin, lastFrame } = renderContainer();

    await flush();
    expect(lastFrame() ?? "").toContain("✔ Passed — no issues found");
    expect(lastFrame() ?? "").toContain("[ Run Again ]");
    expect(apiMocks.createReview).not.toHaveBeenCalled();

    stdin.write("\r");
    await waitUntil(() => apiMocks.createReview.mock.calls.length === 1);

    expect(apiMocks.createReview).toHaveBeenCalledWith({ mode: "staged" });
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
    const cancel = vi.fn(async () => ({
      status: "cancelled" as const,
      reason: "cancelled" as const,
    }));
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ cancel, isStreaming: true, reviewId: "review-123" }),
    );

    const { stdin, lastFrame } = renderContainer({ showFooterProbe: true });

    await waitUntil(() => (lastFrame() ?? "").includes("c Cancel"));
    expect(lastFrame() ?? "").toContain("Esc Back");

    stdin.write(ESC);

    await waitUntil(() => (lastFrame() ?? "").includes("Home route"));
    expect(cancel).not.toHaveBeenCalled();
    expect(apiMocks.clearActiveSession).not.toHaveBeenCalled();
  });

  test("running c cancels on the server while Enter remains inert", async () => {
    const cancel = vi.fn(async () => ({
      status: "cancelled" as const,
      reason: "cancelled" as const,
    }));
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

  test("a reducer-stopped stream no longer exposes Cancel", () => {
    const cancel = vi.fn(async () => ({
      status: "cancelled" as const,
      reason: "cancelled" as const,
    }));
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
    apiMocks.useConfigurationInit.mockReturnValue({
      data: makeUnconfiguredInitResponse(),
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
    expect(frame).toContain("Configuration Not Ready");
    expect(frame).toContain("This product has not been configured");
  });

  test("config load failure offers provider setup recovery beside Retry", async () => {
    const refetch = vi.fn(() => Promise.resolve());
    apiMocks.useConfigurationInit.mockReturnValue({
      data: undefined,
      error: new Error("config load failed"),
      isLoading: false,
      refetch,
    });
    apiMocks.useReviewLifecycleBase.mockReturnValue(makeReviewLifecycleBase());

    const { stdin, lastFrame } = renderContainer({ showFooterProbe: true });

    await waitUntil(() => (lastFrame() ?? "").includes("Configuration Unavailable"));
    await waitUntil(() => (lastFrame() ?? "").includes("p Providers"));
    expect(lastFrame() ?? "").toContain("Configure Provider");

    stdin.write("\r");
    await waitUntil(() => refetch.mock.calls.length === 1);

    stdin.write("p");
    await waitUntil(() => (lastFrame() ?? "").includes("Route: settings/providers"));
  });

  test("a run the create call answered opens on the no-changes view instead of the progress frame", async () => {
    // The admitted-outcome case: no stream event has landed yet, so the run
    // still looks freshly started — steps unwalked, no error, no reviewId.
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        gate: "no-diff",
        isNoDiffError: true,
        hasStarted: false,
        steps: [],
        issues: [],
        events: [],
        reviewId: null,
        startedAt: null,
      }),
    );

    const { lastFrame } = renderContainer({
      initialRoute: { screen: "review", mode: "staged", live: true },
    });

    expect(lastFrame() ?? "").toContain("No staged changes");
    expect(lastFrame() ?? "").not.toContain("Live Activity Log");
  });

  test("Switch Mode from an unconfigured resumed no-diff review opens provider setup without resetting first", async () => {
    apiMocks.useConfigurationInit.mockReturnValue({
      data: makeUnconfiguredInitResponse(),
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
    // A fresh install has no provider consent yet, so the switch asks for it first.
    await waitUntil(() => (lastFrame() ?? "").includes("Provider data notice"));
    stdin.write("\r");
    await waitUntil(() => (lastFrame() ?? "").includes("Route: settings/providers"));

    expect(lastFrame() ?? "").toContain("Route: settings/providers");
    expect(apiMocks.saveSettings).toHaveBeenCalledOnce();
    expect(apiMocks.createReview).not.toHaveBeenCalled();
    expect(lifecycle.stream.abort).not.toHaveBeenCalled();
    expect(lifecycle.reset).not.toHaveBeenCalled();
  });

  test("Switch Mode asks for the provider consent once and Escape leaves the no-diff screen as it was", async () => {
    const init = makeReadyInitResponse();
    apiMocks.useConfigurationInit.mockReturnValue({
      data: { ...init, settings: { ...init.settings, providerConsent: null } },
      isLoading: false,
    });
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        gate: "no-diff",
        isNoDiffError: true,
        error: "No changes to review.",
        errorCode: ReviewErrorCode.NO_DIFF,
      }),
    );

    const { stdin, lastFrame } = renderContainer({
      initialRoute: { screen: "review", reviewId: "review-123", mode: "staged", live: true },
    });

    expect(lastFrame() ?? "").toContain("No staged changes");
    stdin.write("\r");
    await waitUntil(() => (lastFrame() ?? "").includes("Provider data notice"));
    expect(lastFrame() ?? "").toContain("[ Accept and continue ]");
    expect(apiMocks.createReview).not.toHaveBeenCalled();

    // Not now: nothing is saved or started, the no-diff screen is back.
    stdin.write(ESC);
    await waitUntil(() => (lastFrame() ?? "").includes("No staged changes"));
    expect(apiMocks.saveSettings).not.toHaveBeenCalled();
    expect(apiMocks.createReview).not.toHaveBeenCalled();

    // Enter accepts: the consent is recorded, then the alternate review starts.
    stdin.write("\r");
    await waitUntil(() => (lastFrame() ?? "").includes("Provider data notice"));
    stdin.write("\r");
    await waitUntil(() =>
      apiMocks.createReview.mock.calls.some(([request]) => request.mode === "unstaged"),
    );
    expect(apiMocks.saveSettings).toHaveBeenCalledWith({
      providerConsent: { version: 1, acceptedAt: expect.any(String) },
    });
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

  test("creates an alternate-mode review on a live route instead of stalling on loading", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        gate: "no-diff",
        isNoDiffError: true,
        error: "No changes to review.",
        errorCode: ReviewErrorCode.NO_DIFF,
      }),
    );

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

    await waitUntil(() =>
      apiMocks.createReview.mock.calls.some(([request]) => request.mode === "unstaged"),
    );
    expect(lastFrame() ?? "").not.toContain("Starting review...");
  });

  test("draws the review surface while the session is still being created", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        hasStarted: false,
        isStreaming: false,
        startedAt: null,
        reviewId: null,
        steps: [
          { id: "diff", label: "Collect diff", status: "pending" },
          { id: "context", label: "Project context", status: "pending" },
        ],
      }),
    );

    const { lastFrame } = renderContainer({
      initialRoute: { screen: "review", mode: "unstaged" },
    });
    await flush();

    const frame = frameText(lastFrame());
    expect(frame).toContain("PROGRESS OVERVIEW");
    expect(frame).toContain("LIVE ACTIVITY LOG");
    expect(frame).toContain("Collect diff");
    expect(frame).not.toContain("Starting review");
  });

  test("keeps Escape live while the session is still being created", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ hasStarted: false, isStreaming: false, startedAt: null }),
    );

    const { stdin, lastFrame } = renderContainer({
      initialRoute: { screen: "review", mode: "unstaged" },
    });
    await flush();

    stdin.write(ESC);
    await waitUntil(() => (lastFrame() ?? "").includes("Home route"));
  });

  test("keeps the plain readout while configuration is still loading", async () => {
    apiMocks.useConfigurationInit.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
    });

    const { lastFrame } = renderContainer({
      initialRoute: { screen: "review", mode: "unstaged" },
    });
    await flush();

    const frame = frameText(lastFrame());
    expect(frame).toContain("Loading configuration");
    expect(frame).not.toContain("PROGRESS OVERVIEW");

    // The readout takes the frame the run would have filled instead of hanging
    // off the top-left corner, so it must sit centered, not at column 0.
    const readoutLine = stripAnsi(lastFrame())
      .split("\n")
      .find((line) => line.includes("Loading configuration"));
    expect(readoutLine).toMatch(/^ {2,}\S/);
  });
  test("offers the file picker on a failure a narrower run would survive", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: OVER_WINDOW_ERROR,
        errorCode: ReviewErrorCode.DIFF_TOO_LARGE,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
      }),
    );

    const { stdin, lastFrame } = renderContainer({
      showFooterProbe: true,
      gitStatus: STAGED_TWO_FILES,
    });
    await flush();

    const failureFrame = frameText(lastFrame());
    expect(failureFrame).toContain("[ Review Specific Files ]");
    expect(failureFrame).toContain("f Review Specific Files");

    stdin.write("f");
    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));

    const pickerFrame = frameText(lastFrame());
    expect(pickerFrame).toContain("Select Staged Files");
    expect(pickerFrame).toContain("a All, n None, s Review Selected");
    expect(pickerFrame).toContain("does not fit gpt-test");

    stdin.write(ESC);
    await waitUntil(() => frameText(lastFrame()).includes("Diff Too Large"));
  });

  test("starts a new review when the picker keeps every file on an attached run", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: OVER_WINDOW_ERROR,
        errorCode: ReviewErrorCode.DIFF_TOO_LARGE,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
      }),
    );

    const { stdin, lastFrame } = renderContainer({
      initialRoute: { screen: "review", reviewId: "review-123", mode: "staged", live: true },
      gitStatus: STAGED_TWO_FILES,
    });
    await flush();

    stdin.write("f");
    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));

    stdin.write("a");
    await waitUntil(() => frameText(lastFrame()).includes("2 selected"));
    stdin.write("s");

    await waitUntil(() => apiMocks.createReview.mock.calls.length > 0);
    expect(apiMocks.createReview).toHaveBeenCalledWith(expect.objectContaining({ mode: "staged" }));
    expect(apiMocks.createReview.mock.calls[0]?.[0]).not.toHaveProperty("files");
  });

  test("re-runs the narrowed file set the finished run started with", async () => {
    apiMocks.useReviewLifecycleBase.mockImplementation(({ onComplete }) => {
      useEffect(() => {
        onComplete();
      }, [onComplete]);

      return makeReviewLifecycleBase({ issues: [] });
    });

    const { stdin, lastFrame } = renderContainer({
      initialRoute: { screen: "review", mode: "staged", pickFiles: true },
      gitStatus: STAGED_TWO_FILES,
    });
    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));

    stdin.write(" ");
    await waitUntil(() => frameText(lastFrame()).includes("1 selected"));
    stdin.write("s");

    await waitUntil(() => apiMocks.createReview.mock.calls.length === 1);
    expect(apiMocks.createReview).toHaveBeenCalledWith({ mode: "staged", files: ["src/a.ts"] });

    // Same scope means the same files: Run Again must not widen a narrowed run
    // back out to the whole staged diff.
    await flush();
    await waitUntil(() => frameText(lastFrame()).includes("[ Run Again ]"));
    stdin.write("\r");

    await waitUntil(() => apiMocks.createReview.mock.calls.length === 2);
    expect(apiMocks.createReview).toHaveBeenLastCalledWith({
      mode: "staged",
      files: ["src/a.ts"],
    });
  });

  test.each([
    ReviewErrorCode.MODEL_INCOMPATIBLE,
    ReviewErrorCode.GENERATION_FAILED,
  ])("keeps the picker away from a %s failure a smaller file set cannot fix", async (errorCode) => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Adapter response failed schema validation.",
        errorCode,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
      }),
    );

    const { lastFrame } = renderContainer({ gitStatus: STAGED_TWO_FILES });
    await flush();

    expect(frameText(lastFrame())).not.toContain("Review Specific Files");
  });

  test("lets a warned run stop and narrow itself from the progress screen", async () => {
    const cancel = vi.fn(async () => ({
      status: "cancelled" as const,
      reason: "cancelled" as const,
    }));
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        cancel,
        isStreaming: true,
        reviewId: "review-123",
        sizeWarning: SIZE_WARNING,
      }),
    );

    const { stdin, lastFrame } = renderContainer({
      showFooterProbe: true,
      gitStatus: STAGED_TWO_FILES,
    });
    await flush();

    const runningFrame = frameText(lastFrame());
    expect(runningFrame).toContain("Large Review");
    expect(runningFrame).toContain("about 190,000 prompt tokens");
    expect(runningFrame).toContain("f Filter Files");

    stdin.write("f");
    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));
    expect(frameText(lastFrame())).toContain("Select Staged Files");

    // The run is stopped before the picker opens: the server takes one review at
    // a time, so a narrowed start would otherwise be refused.
    expect(cancel).toHaveBeenCalledWith("review-123");
  });
});
