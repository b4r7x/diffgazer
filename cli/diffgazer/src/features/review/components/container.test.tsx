import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { ReviewEvent } from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { makeAllConfigurationsListResponse } from "@diffgazer/core/testing/provider-fixtures";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { act, type ReactElement, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation";
import { useNavigation } from "../../../hooks/use-navigation";
import type { Route } from "../../../lib/routes";
import { ApiBoundary } from "../../../testing/api-boundary";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { frameText, stripAnsi } from "../testing/frame-text";
import { makeReviewLifecycleBase } from "../testing/review-lifecycle-base";

const shellList = makeAllConfigurationsListResponse();

function makeReadyInitResponse() {
  return {
    schemaVersion: 2 as const,
    configurations: shellList.configurations,
    selectedConfigurationId: shellList.selectedConfigurationId,
    settings: {
      theme: "dark" as const,
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low" as const,
      secretsStorage: "file" as const,
      agentExecution: "sequential" as const,
      // A finished install: the consent is on record, so a switch starts at once.
      providerConsent: { version: 1 as const, acceptedAt: "2026-08-01T09:00:00.000Z" },
    },
    project: {
      projectId: "project-1",
      path: "/Users/dev/Projects/diffgazer-workspace",
      trust: {
        repoRoot: "/Users/dev/Projects/diffgazer-workspace",
        capabilities: { readFiles: true, runCommands: false },
        projectId: "project-1",
        trustedAt: "2026-01-01T00:00:00.000Z",
        trustMode: "persistent" as const,
      },
    },
  };
}

function makeUnconfiguredInitResponse() {
  return {
    schemaVersion: 2 as const,
    configurations: [],
    selectedConfigurationId: null,
    settings: {
      theme: "dark" as const,
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low" as const,
      secretsStorage: "file" as const,
      agentExecution: "sequential" as const,
      providerConsent: null,
    },
    project: {
      projectId: "project-1",
      path: "/Users/dev/Projects/diffgazer-workspace",
      trust: {
        repoRoot: "/Users/dev/Projects/diffgazer-workspace",
        capabilities: { readFiles: true, runCommands: false },
        projectId: "project-1",
        trustedAt: "2026-01-01T00:00:00.000Z",
        trustMode: "persistent" as const,
      },
    },
  };
}

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

const ESC = "\u001b";
const ARROW_RIGHT = "\u001b[C";

const PARTIAL_LENS_STATS: LensStat[] = [
  { lensId: "correctness", issueCount: 1, status: "success" },
  { lensId: "performance", issueCount: 0, status: "success" },
  { lensId: "security", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
  { lensId: "simplicity", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
  { lensId: "tests", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
];

function makeOrchestratorComplete(lensStats: LensStat[]): ReviewEvent {
  return {
    type: "orchestrator_complete",
    totalIssues: 1,
    filesAnalyzed: 1,
    lensStats,
    timestamp: "2026-01-01T00:00:05.000Z",
  };
}

function RouteHarness({
  onViewRunDetails,
}: {
  onViewRunDetails?: (reviewId: string) => void;
}): ReactElement {
  const { route } = useNavigation();

  if (route.screen !== "review") {
    return <Text>{route.screen === "home" ? "Home route" : `Route: ${route.screen}`}</Text>;
  }

  return (
    <ReviewContainer
      mode={route.mode}
      reviewId={route.reviewId}
      allowResumeWithoutSetup={route.live}
      onViewRunDetails={onViewRunDetails}
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
  onViewRunDetails,
}: {
  initialRoute?: Route;
  initialShortcuts?: Shortcut[];
  showFooterProbe?: boolean;
  onViewRunDetails?: (reviewId: string) => void;
} = {}) {
  return render(
    <ApiBoundary api={{ saveSettings: apiMocks.saveSettings }}>
      <CliThemeProvider initialTheme="dark">
        <TerminalKeyboardProvider>
          <NavigationProvider initialRoute={initialRoute}>
            <FooterProvider initialShortcuts={initialShortcuts}>
              <RouteHarness onViewRunDetails={onViewRunDetails} />
              {showFooterProbe ? <FooterProbe /> : null}
            </FooterProvider>
          </NavigationProvider>
        </TerminalKeyboardProvider>
      </CliThemeProvider>
    </ApiBoundary>,
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

    expect(stripAnsi(lastFrame() ?? "")).toContain("Elapsed: 00:05");

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

  test("generic terminal stream errors show Back/Escape instead of streaming Cancel", async () => {
    const cancel = vi.fn(async () => ({
      status: "cancelled" as const,
      reason: "cancelled" as const,
    }));
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

  test("offers the saved run when a lens completed before the review failed", async () => {
    const onViewRunDetails = vi.fn();
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Review budget exhausted at maxInputTokens (119808).",
        errorCode: ReviewErrorCode.BUDGET_EXHAUSTED,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [makeOrchestratorComplete(PARTIAL_LENS_STATS)],
      }),
    );

    const { stdin, lastFrame } = renderContainer({ onViewRunDetails, showFooterProbe: true });

    await waitUntil(() => (lastFrame() ?? "").includes("Left/Right Actions"));
    const frame = frameText(lastFrame());
    expect(frame).toContain("Budget Exhausted");
    expect(frame).toContain("Reduce the review scope or raise the configured budget");
    expect(frame).toContain("[ View Run Details ]");
    expect(frame).toContain("Footer left: Left/Right Actions, Enter Select right: Esc Back");

    stdin.write("\r");
    await waitUntil(() => onViewRunDetails.mock.calls.length === 1);

    expect(onViewRunDetails).toHaveBeenCalledWith("review-123");
    // The failed run is over: home must not keep offering it as resumable.
    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "review-123");
  });

  test("keeps the dead end when no lens completed", () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Review budget exhausted at maxInputTokens (119808).",
        errorCode: ReviewErrorCode.BUDGET_EXHAUSTED,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [
          makeOrchestratorComplete(
            PARTIAL_LENS_STATS.map((lens) => ({
              ...lens,
              issueCount: 0,
              status: "failed" as const,
              errorCode: "BUDGET_EXHAUSTED",
            })),
          ),
        ],
      }),
    );

    const frame = frameText(renderContainer({ onViewRunDetails: vi.fn() }).lastFrame());

    expect(frame).toContain("Budget Exhausted");
    expect(frame).not.toContain("View Run Details");
    expect(frame).toContain("[ Back ]");
  });

  test("keeps the dead end when the run ended before it reached disk", () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Review is no longer pending.",
        errorCode: ReviewErrorCode.CANCELLED,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [makeOrchestratorComplete(PARTIAL_LENS_STATS)],
      }),
    );

    const frame = frameText(renderContainer({ onViewRunDetails: vi.fn() }).lastFrame());

    expect(frame).not.toContain("View Run Details");
    expect(frame).toContain("[ Back ]");
  });

  test("keeps the dead end when the run itself could not be saved", () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Failed to save the review.",
        errorCode: ReviewErrorCode.INTERNAL_ERROR,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [makeOrchestratorComplete(PARTIAL_LENS_STATS)],
      }),
    );

    const frame = frameText(renderContainer({ onViewRunDetails: vi.fn() }).lastFrame());

    expect(frame).not.toContain("View Run Details");
    expect(frame).toContain("[ Back ]");
  });

  test("offers the providers CTA beside the run when a recoverable failure reported a lens", async () => {
    const onViewRunDetails = vi.fn();
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Adapter response failed schema validation.",
        errorCode: ReviewErrorCode.MODEL_INCOMPATIBLE,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [makeOrchestratorComplete(PARTIAL_LENS_STATS)],
      }),
    );

    const { stdin, lastFrame } = renderContainer({ onViewRunDetails, showFooterProbe: true });

    await waitUntil(() => (lastFrame() ?? "").includes("Left/Right Actions"));
    const frame = frameText(lastFrame());
    // Web parity: the run the review already paid for and the CTA that repairs
    // the failure are offered together, Back last.
    expect(frame).toContain("[ View Run Details ]");
    expect(frame).toContain("[ Change model ]");
    expect(frame).toContain("[ Back ]");
    expect(frame).toContain(
      "Footer left: Left/Right Actions, Enter Select, p Change model right: Esc Back",
    );

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write("\r");

    await waitUntil(() => (lastFrame() ?? "").includes("Route: settings/providers"));
    expect(onViewRunDetails).not.toHaveBeenCalled();
  });

  test("shows the admission fast-fail inline with the server remediation and a providers jump", async () => {
    const remediation =
      "This model could not produce Diffgazer's structured review output. Select a different model or update the configuration.";
    apiMocks.createReview.mockRejectedValue(
      Object.assign(new Error(remediation), { code: "SETUP_REQUIRED", status: 403 }),
    );
    apiMocks.useReviewLifecycleBase.mockReturnValue(makeReviewLifecycleBase());

    const { stdin, lastFrame } = renderContainer({
      initialRoute: { screen: "review", mode: "unstaged" },
    });

    await waitUntil(() => (lastFrame() ?? "").includes("Configuration Needs Attention"));
    const frame = frameText(lastFrame());
    expect(frame).toContain(remediation);
    expect(frame).toContain("Press p — Open Providers.");
    expect(frame).not.toContain("Cancel");

    // The key handler attaches a tick after the error frame lands.
    await flush();
    stdin.write("p");
    await waitUntil(() => (lastFrame() ?? "").includes("Route: settings/providers"));
  });

  test("routes an incompatible model to the providers screen from the terminal error", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Adapter response failed schema validation.",
        errorCode: ReviewErrorCode.MODEL_INCOMPATIBLE,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
      }),
    );

    const { stdin, lastFrame } = renderContainer();

    await waitUntil(() => (lastFrame() ?? "").includes("Model Incompatible"));
    const frame = frameText(lastFrame());
    expect(frame).toContain("Adapter response failed schema validation.");
    expect(frame).toContain("Change the model or update the configuration");
    // The key is named by the same CTA the web button carries.
    expect(frame).toContain("Press p — Change model.");

    stdin.write("p");
    await waitUntil(() => (lastFrame() ?? "").includes("Route: settings/providers"));
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
});
