import { FooterProvider } from "@diffgazer/core/footer";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { makeReadyInitResponse } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation";
import type { Route } from "../../../lib/routes";
import { ApiBoundary } from "../../../testing/api-boundary";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { makeReviewLifecycleBase } from "../testing/review-lifecycle-base";

const ESCAPE = "\u001B";

const apiMocks = vi.hoisted(() => ({
  clearActiveSession: vi.fn(),
  createReview: vi.fn(),
  useCreateReview: vi.fn(),
  useConfigurationInit: vi.fn(),
  useReview: vi.fn(),
  useReviewLifecycleBase: vi.fn(),
}));

// Boundary mock: network - core api hooks wrap fetch-backed API calls.
vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useCreateReview: apiMocks.useCreateReview,
  useConfigurationInit: apiMocks.useConfigurationInit,
  useReview: apiMocks.useReview,
  useReviewLifecycleBase: apiMocks.useReviewLifecycleBase,
  useReviewSessionCache: () => ({
    clearActiveSession: apiMocks.clearActiveSession,
  }),
}));

vi.mock("../../../components/layout/global", () => ({
  getContentZoneRows: (rows: number) => Math.max(rows - 4, 0),
  useContentZone: () => ({ columns: 100, contentColumns: 100, contentRows: 26 }),
}));

import { CliThemeProvider } from "../../../theme/provider";
import { ReviewScreen } from "./screen";

afterEach(() => {
  cleanup();
});

describe("ReviewScreen", () => {
  beforeEach(() => {
    apiMocks.clearActiveSession.mockReset();
    apiMocks.createReview.mockReset();
    apiMocks.useCreateReview.mockReturnValue({ mutateAsync: apiMocks.createReview });
    apiMocks.useConfigurationInit.mockReturnValue({
      data: makeReadyInitResponse(),
      isLoading: false,
    });
    apiMocks.useReview.mockReset();
    apiMocks.useReviewLifecycleBase.mockReturnValue(makeReviewLifecycleBase({ isStreaming: true }));
  });

  test("renders live review progress when no saved review is loaded", () => {
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: undefined,
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/progress overview/i);
    expect(frame).toMatch(/live activity log/i);
    // Cancel is published to the shortcut bar, never restated in the body.
    expect(frame).not.toContain("Cancel");
    expect(apiMocks.clearActiveSession).not.toHaveBeenCalled();
  });

  test("opens a completed saved review at its findings instead of its summary", () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved issue", symptom: "Saved symptom" });
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: {
        review: { metadata: { id: "review-123", durationMs: 10 }, result: { issues: [issue] } },
      },
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Saved symptom");
    expect(frame).not.toMatch(/review complete/i);
  });

  test("opens a completed saved review that found nothing at its summary", () => {
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: { review: { metadata: { id: "review-123", durationMs: 10 }, result: { issues: [] } } },
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/review complete/i);
    expect(frame).toContain("Found 0 issues across 0 files with issues.");
  });

  test("returns a completed saved review to its summary with Escape from the findings", async () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved issue", symptom: "Saved symptom" });
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: {
        review: { metadata: { id: "review-123", durationMs: 10 }, result: { issues: [issue] } },
      },
    });

    const { lastFrame, stdin } = renderReviewScreen();

    expect(lastFrame() ?? "").toContain("Saved symptom");

    // The findings screen is the landing view, so the summary it skipped stays
    // one keystroke away. Ink holds a bare Escape briefly to tell it apart from
    // the start of a control sequence, so this waits on a timer, not a frame.
    stdin.write(ESCAPE);

    await vi.waitFor(() => expect(lastFrame() ?? "").toMatch(/review complete/i));
  });

  test("renders the terminal receipt for a saved review that never completed", () => {
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: {
        review: {
          metadata: { id: "review-cancelled", durationMs: 10 },
          result: { issues: [] },
          execution: {
            receipt: { outcome: "budget-exhausted", usageAvailability: "unavailable" },
          },
        },
      },
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/budget exhausted/i);
    expect(frame).toMatch(/usage unavailable/i);
    expect(frame).not.toMatch(/review complete/i);
    expect(frame).not.toMatch(/progress overview/i);
  });

  test("opens a terminal run whose lenses reported into the failure-mode summary", () => {
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: {
        review: {
          metadata: { id: "review-partial", durationMs: 48_352 },
          result: { issues: [makeIssue({ id: "issue-1", title: "Kept finding" })] },
          lensStats: [
            { lensId: "correctness", issueCount: 1, status: "success" },
            { lensId: "security", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
          ],
          execution: {
            receipt: { outcome: "budget-exhausted", usageAvailability: "reported" },
          },
        },
      },
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/budget exhausted/i);
    expect(frame).toContain("1 of 2 lenses completed · 1 issue");
    expect(frame).toContain("Kept finding");
    expect(frame).toContain("failed (BUDGET_EXHAUSTED)");
    expect(frame).not.toMatch(/review complete/i);
  });

  test("names the outcome on a findings deep link that opens past the summary", () => {
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: {
        review: {
          metadata: { id: "review-partial", durationMs: 48_352 },
          result: {
            issues: [
              makeIssue({ id: "issue-1", title: "Kept finding", symptom: "Kept finding symptom" }),
            ],
          },
          lensStats: [
            { lensId: "correctness", issueCount: 1, status: "success" },
            { lensId: "security", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
          ],
          execution: {
            receipt: { outcome: "budget-exhausted", usageAvailability: "reported" },
          },
        },
      },
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "review-partial",
      issueId: "issue-1",
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Kept finding symptom");
    expect(frame).toContain(
      "Budget Exhausted — The review stopped because a configured budget limit was reached.",
    );
  });

  test("hands a failed live run over to its saved record instead of ending on the error", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "Review budget exhausted at maxInputTokens (119808).",
        errorCode: "BUDGET_EXHAUSTED",
        gate: "terminal-error",
        isTerminalStreamError: true,
        reviewId: "review-123",
        events: [
          {
            type: "orchestrator_complete",
            totalIssues: 1,
            filesAnalyzed: 1,
            lensStats: [
              { lensId: "correctness", issueCount: 1, status: "success" },
              {
                lensId: "security",
                issueCount: 0,
                status: "failed",
                errorCode: "BUDGET_EXHAUSTED",
              },
            ],
            timestamp: "2026-01-01T00:00:05.000Z",
          },
        ],
      }),
    );
    apiMocks.useReview.mockImplementation((id: string | null) =>
      id
        ? {
            status: "success" as const,
            data: {
              review: {
                metadata: { id, durationMs: 48_352 },
                result: { issues: [makeIssue({ id: "issue-1", title: "Kept finding" })] },
                lensStats: [
                  { lensId: "correctness", issueCount: 1, status: "success" },
                  {
                    lensId: "security",
                    issueCount: 0,
                    status: "failed",
                    errorCode: "BUDGET_EXHAUSTED",
                  },
                ],
                execution: {
                  receipt: { outcome: "budget-exhausted", usageAvailability: "reported" },
                },
              },
            },
          }
        : { status: "pending" as const },
    );

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "review-123",
      mode: "staged",
      live: true,
    });

    await waitUntil(() => (lastFrame() ?? "").includes("BUDGET EXHAUSTED"));

    const frame = lastFrame() ?? "";
    expect(frame).toContain("1 of 2 lenses completed · 1 issue");
    expect(frame).not.toMatch(/review complete/i);
    expect(frame).not.toMatch(/progress overview/i);
  });

  test("renders the persisted duplicate-collapse notice in a reopened review", () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved issue" });
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: {
        review: {
          metadata: { id: "review-123", durationMs: 10 },
          result: { issues: [issue] },
          droppedDuplicates: 1,
        },
      },
    });

    const { lastFrame } = renderReviewScreen();

    expect(lastFrame() ?? "").toContain("1 duplicate issue collapsed across lenses (2 → 1 issue)");
  });

  test("opens a saved issue directly with its duplicate-collapse disclosure", () => {
    const first = makeIssue({ id: "issue-1", title: "First issue", symptom: "First symptom" });
    const selected = makeIssue({
      id: "issue-2",
      title: "Selected issue",
      symptom: "Selected issue symptom",
    });
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: {
        review: {
          metadata: { id: "review-123", durationMs: 10 },
          result: { issues: [first, selected] },
          droppedDuplicates: 1,
        },
      },
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "review-123",
      issueId: "issue-2",
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Selected issue symptom");
    expect(frame).toContain("1 duplicate issue collapsed across lenses (3 → 2 issues)");
    expect(frame).not.toContain("First symptom");
    expect(frame).not.toMatch(/review complete/i);
  });

  test("ignores an unknown route issue and opens the run's first finding", () => {
    const first = makeIssue({ id: "issue-1", title: "First issue", symptom: "First symptom" });
    const second = makeIssue({ id: "issue-2", title: "Second issue", symptom: "Second symptom" });
    apiMocks.useReview.mockReturnValue({
      status: "success",
      data: {
        review: {
          metadata: { id: "review-123", durationMs: 10 },
          result: { issues: [first, second] },
        },
      },
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "review-123",
      issueId: "missing-issue",
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain("First symptom");
    expect(frame).not.toContain("Second symptom");
  });

  test("surfaces an error view on a non-404 saved-read failure instead of resuming the stream", () => {
    apiMocks.useReview.mockReturnValue({
      status: "error",
      error: new Error("legacy review rejected"),
    });

    const { lastFrame } = renderReviewScreen();

    expect(lastFrame()).toContain("Could not load review");
    expect(lastFrame()).toContain("legacy review rejected");
    expect(lastFrame()).not.toMatch(/progress overview/i);
  });

  test("live active-session resume ignores pending saved-review reads", () => {
    apiMocks.useReview.mockReturnValue({
      status: "pending",
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "review-123",
      mode: "staged",
      live: true,
    });

    expect(lastFrame()).toMatch(/progress overview/i);
    // null, not a sentinel id: the saved-review query must stay unrunnable.
    expect(apiMocks.useReview).toHaveBeenCalledWith(null);
  });

  test("shows the loading state for a pending saved-review read on the default non-live route", () => {
    apiMocks.useReview.mockReturnValue({
      status: "pending",
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Loading review...");
    expect(frame).not.toMatch(/progress overview/i);
  });

  test("live active-session resume ignores saved-review read errors", () => {
    apiMocks.useReview.mockReturnValue({
      status: "error",
      error: new Error("history lookup failed"),
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "review-123",
      mode: "staged",
      live: true,
    });

    expect(lastFrame()).toMatch(/progress overview/i);
    expect(lastFrame()).not.toContain("history lookup failed");
  });

  test("active-session resume bypasses setup while new review start remains setup-gated", () => {
    apiMocks.useConfigurationInit.mockReturnValue({
      data: { ...makeReadyInitResponse(), configurations: [], selectedConfigurationId: null },
      isLoading: false,
    });
    apiMocks.useReviewLifecycleBase.mockImplementation((options) =>
      makeReviewLifecycleBase({
        gate:
          options.readiness?.ready || options.allowResumeWithoutSetup ? "running" : "unconfigured",
        isStreaming: true,
      }),
    );
    apiMocks.useReview.mockReturnValue({
      status: "pending",
    });

    const live = renderReviewScreen({
      screen: "review",
      reviewId: "review-123",
      mode: "staged",
      live: true,
    });

    expect(live.lastFrame()).toMatch(/progress overview/i);
    expect(live.lastFrame()).not.toMatch(/api key/i);
    cleanup();
    apiMocks.createReview.mockClear();

    const fresh = renderReviewScreen({ screen: "review", mode: "staged" });

    expect(fresh.lastFrame()).toMatch(/configuration not ready/i);
    expect(apiMocks.createReview).not.toHaveBeenCalled();
  });
});

describe("ReviewScreen saved-review fallback", () => {
  let onNotFoundInSession: ((reviewId: string) => void) | undefined;

  beforeEach(() => {
    onNotFoundInSession = undefined;
    apiMocks.useReviewLifecycleBase.mockImplementation((options) => {
      onNotFoundInSession = options.onNotFoundInSession;
      return makeReviewLifecycleBase({ isStreaming: true });
    });
  });

  test("falls back to a saved review after a live stream returns 404", async () => {
    const reviewId = "review-123";
    const issue = makeIssue({ id: "saved-1", title: "Saved fallback issue" });
    apiMocks.useReview.mockImplementation((id: string) => {
      if (!id) {
        return { status: "pending" as const };
      }
      return {
        status: "success" as const,
        data: {
          review: { metadata: { id: reviewId, durationMs: 10 }, result: { issues: [issue] } },
        },
      };
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId,
      mode: "staged",
      live: true,
    });

    expect(lastFrame()).toMatch(/progress overview/i);
    expect(onNotFoundInSession).toBeTypeOf("function");

    onNotFoundInSession?.(reviewId);
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Saved fallback issue");
    expect(frame).not.toMatch(/review complete/i);
    expect(frame).not.toMatch(/progress overview/i);
  });

  test("reports not-found when both the live stream and saved review return 404", async () => {
    const reviewId = "review-123";
    const notFoundError = Object.assign(new Error("HTTP 404"), { status: 404 });
    apiMocks.useReview.mockImplementation((id: string) => {
      if (!id) {
        return { status: "pending" as const };
      }
      return { status: "error" as const, error: notFoundError };
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId,
      mode: "staged",
      live: true,
    });

    onNotFoundInSession?.(reviewId);
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/review not found/i);
    expect(frame).toContain("no saved results are available");
    expect(frame).not.toMatch(/progress overview/i);
  });

  test("resumes the stream when a saved review returns 404 while setup is incomplete", () => {
    apiMocks.useConfigurationInit.mockReturnValue({
      data: { ...makeReadyInitResponse(), configurations: [], selectedConfigurationId: null },
      isLoading: false,
    });
    apiMocks.useReviewLifecycleBase.mockImplementation((options) =>
      makeReviewLifecycleBase({
        gate:
          options.readiness?.ready || options.allowResumeWithoutSetup ? "running" : "unconfigured",
        isStreaming: true,
      }),
    );
    apiMocks.useReview.mockReturnValue({
      status: "error",
      error: Object.assign(new Error("HTTP 404"), { status: 404 }),
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "missing-review",
      mode: "staged",
    });

    expect(lastFrame()).toMatch(/progress overview/i);
    expect(lastFrame()).not.toMatch(/configuration not ready/i);
  });
});

function renderReviewScreen(
  initialRoute: Route = { screen: "review", reviewId: "review-123", mode: "staged" },
) {
  return render(
    <ApiBoundary>
      <CliThemeProvider initialTheme="dark">
        <TerminalKeyboardProvider>
          <NavigationProvider initialRoute={initialRoute}>
            <FooterProvider initialShortcuts={[]}>
              <ReviewScreen />
            </FooterProvider>
          </NavigationProvider>
        </TerminalKeyboardProvider>
      </CliThemeProvider>
    </ApiBoundary>,
  );
}
