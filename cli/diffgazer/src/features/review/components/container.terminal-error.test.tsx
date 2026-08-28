import type { ReviewEvent } from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { cleanup } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import {
  ESC,
  makeReadyInitResponse,
  renderReviewContainer as renderContainer,
} from "../testing/container-harness";
import { frameText } from "../testing/frame-text";
import { makeReviewLifecycleBase } from "../testing/review-lifecycle-base";

const apiMocks = vi.hoisted(() => ({
  clearActiveSession: vi.fn(),
  createReview: vi.fn(),
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
  apiMocks.useReviewLifecycleBase.mockReturnValue(makeReviewLifecycleBase());
});

const PARTIAL_LENS_STATS: LensStat[] = [
  { lensId: "correctness", issueCount: 1, status: "success" },
  { lensId: "performance", issueCount: 0, status: "success" },
  { lensId: "security", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
  { lensId: "simplicity", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
  { lensId: "tests", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
];

const FAILED_LENS_STATS: LensStat[] = PARTIAL_LENS_STATS.map((lens) => ({
  ...lens,
  issueCount: 0,
  status: "failed" as const,
}));

function makeOrchestratorComplete(lensStats: LensStat[]): ReviewEvent {
  return {
    type: "orchestrator_complete",
    totalIssues: 1,
    filesAnalyzed: 1,
    lensStats,
    timestamp: "2026-01-01T00:00:05.000Z",
  };
}

describe("ReviewContainer terminal errors", () => {
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

  test("keeps the streamed run on screen behind the banner when the session is terminated", () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Review session cancelled because repository state changed.",
        errorCode: ReviewErrorCode.SESSION_STALE,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
      }),
    );

    const frame = frameText(renderContainer().lastFrame());

    // The run is over, but what it streamed is the point: the progress panes
    // stay, with the cause named in the banner under them.
    expect(frame).toContain("Session Expired");
    expect(frame).toContain("LIVE ACTIVITY LOG");
    expect(frame).toContain("Issues Found: 1");
  });

  test("opens the saved run without a keypress when a lens completed before the review failed", async () => {
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

    renderContainer({ onViewRunDetails });

    await waitUntil(() => onViewRunDetails.mock.calls.length === 1);
    expect(onViewRunDetails).toHaveBeenCalledWith("review-123");
    // The failed run is over: home must not keep offering it as resumable.
    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "review-123");

    // One shot: the hand-off happens once per settled run, not once per render.
    await flush();
    await flush();
    expect(onViewRunDetails).toHaveBeenCalledTimes(1);
  });

  test("keeps the dead end when no lens completed", async () => {
    const onViewRunDetails = vi.fn();
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Review budget exhausted at maxInputTokens (119808).",
        errorCode: ReviewErrorCode.BUDGET_EXHAUSTED,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [makeOrchestratorComplete(FAILED_LENS_STATS)],
      }),
    );

    const { lastFrame } = renderContainer({ onViewRunDetails });
    await flush();

    const frame = frameText(lastFrame());
    expect(frame).toContain("Budget Exhausted");
    expect(frame).not.toContain("View Run Details");
    expect(frame).toContain("[ Back ]");
    // Nothing reached disk, so the screen stays put instead of handing off.
    expect(onViewRunDetails).not.toHaveBeenCalled();
  });

  // Lenses reported, but the codes below mean nothing of the run reached disk.
  test.each([
    { errorCode: ReviewErrorCode.CANCELLED, error: "Review is no longer pending." },
    { errorCode: ReviewErrorCode.INTERNAL_ERROR, error: "Failed to save the review." },
  ])("keeps the dead end for a $errorCode run", ({ errorCode, error }) => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error,
        errorCode,
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

  test("shrinks a recoverable dead end to the recovery CTA and Back", async () => {
    const onViewRunDetails = vi.fn();
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Adapter response failed schema validation.",
        errorCode: ReviewErrorCode.MODEL_INCOMPATIBLE,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [makeOrchestratorComplete(FAILED_LENS_STATS)],
      }),
    );

    const { stdin, lastFrame } = renderContainer({ onViewRunDetails, showFooterProbe: true });
    await flush();

    const frame = frameText(lastFrame());
    expect(frame).toContain("[ Change model ]");
    expect(frame).toContain("[ Back ]");
    expect(frame).not.toContain("View Run Details");
    expect(frame).toContain(
      "Footer left: Left/Right Actions, Enter Select, p Change model right: Esc Back",
    );
    expect(onViewRunDetails).not.toHaveBeenCalled();

    stdin.write("p");

    await waitUntil(() => (lastFrame() ?? "").includes("Route: settings/providers"));
  });

  test("leaves a dead end on Esc", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Adapter response failed schema validation.",
        errorCode: ReviewErrorCode.MODEL_INCOMPATIBLE,
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [makeOrchestratorComplete(FAILED_LENS_STATS)],
      }),
    );

    const { stdin, lastFrame } = renderContainer({ onViewRunDetails: vi.fn() });
    await flush();

    stdin.write(ESC);

    await waitUntil(() => (lastFrame() ?? "").includes("Home route"));
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
    expect(frame).toContain("Change the model or update the configuration.");
    // The memo sentence travels only on memo-class failures from the server.
    expect(frame).not.toContain("fail immediately");
    // The key is named by the same CTA the web button carries.
    expect(frame).toContain("Press p — Change model.");

    stdin.write("p");
    // Change model lands in the model dialog itself, not just on the page.
    await waitUntil(() => (lastFrame() ?? "").includes("Route: settings/providers select-model"));
  });
});
