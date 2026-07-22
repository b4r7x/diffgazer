import { FooterProvider } from "@diffgazer/core/footer";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import type { Route } from "../../../lib/routes";
import { makeReviewLifecycleBase } from "../../../testing/review-lifecycle-base";

const apiMocks = vi.hoisted(() => ({
  clearActiveSession: vi.fn(),
  createReview: vi.fn(),
  useCreateReview: vi.fn(),
  useInit: vi.fn(),
  useReview: vi.fn(),
  useReviewLifecycleBase: vi.fn(),
}));

// Boundary mock: network - core api hooks wrap fetch-backed API calls.
vi.mock("@diffgazer/core/api/hooks", () => ({
  useCreateReview: apiMocks.useCreateReview,
  useInit: apiMocks.useInit,
  useReview: apiMocks.useReview,
  useReviewLifecycleBase: apiMocks.useReviewLifecycleBase,
  useReviewSessionCache: () => ({
    clearActiveSession: apiMocks.clearActiveSession,
  }),
}));

vi.mock("../../../components/layout/global", () => ({
  getContentZoneRows: (rows: number) => Math.max(rows - 4, 0),
  useContentZone: () => ({ columns: 100, rows: 30, contentColumns: 100, contentRows: 26 }),
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
    apiMocks.useReview.mockReset();
    apiMocks.useReviewLifecycleBase.mockReturnValue(makeReviewLifecycleBase({ isStreaming: true }));
  });

  test("renders live review progress when no saved review is loaded", () => {
    apiMocks.useReview.mockReturnValue({
      isSuccess: true,
      isError: false,
      data: undefined,
      error: null,
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/progress overview/i);
    expect(frame).toMatch(/live activity log/i);
    expect(frame).toContain("Cancel");
    expect(apiMocks.clearActiveSession).not.toHaveBeenCalled();
  });

  test("renders the saved review summary when saved review data is available", () => {
    apiMocks.useReview.mockReturnValue({
      isSuccess: true,
      isError: false,
      data: { review: { metadata: { id: "review-123", durationMs: 10 }, result: { issues: [] } } },
      error: null,
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/review complete/i);
    expect(frame).toContain("Found 0 issues across 0 files with issues.");
  });

  test("renders the persisted duplicate-collapse notice in a reopened summary", () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved issue" });
    apiMocks.useReview.mockReturnValue({
      isSuccess: true,
      isError: false,
      data: {
        review: {
          metadata: { id: "review-123", durationMs: 10 },
          result: { issues: [issue] },
          droppedDuplicates: 1,
        },
      },
      error: null,
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
      isSuccess: true,
      isError: false,
      data: {
        review: {
          metadata: { id: "review-123", durationMs: 10 },
          result: { issues: [first, selected] },
          droppedDuplicates: 1,
        },
      },
      error: null,
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

  test("falls back to the saved review summary for an unknown route issue", () => {
    const issue = makeIssue({ id: "issue-1", symptom: "Issue detail symptom" });
    apiMocks.useReview.mockReturnValue({
      isSuccess: true,
      isError: false,
      data: {
        review: {
          metadata: { id: "review-123", durationMs: 10 },
          result: { issues: [issue] },
        },
      },
      error: null,
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "review-123",
      issueId: "missing-issue",
    });

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/review complete/i);
    expect(frame).not.toContain("Issue detail symptom");
  });

  test("surfaces an error view on a non-404 saved-read failure instead of resuming the stream", () => {
    apiMocks.useReview.mockReturnValue({
      isSuccess: false,
      isError: true,
      data: undefined,
      error: new Error("legacy review rejected"),
    });

    const { lastFrame } = renderReviewScreen();

    expect(lastFrame()).toContain("Could not load review");
    expect(lastFrame()).toContain("legacy review rejected");
    expect(lastFrame()).not.toMatch(/progress overview/i);
  });

  test("live active-session resume ignores pending saved-review reads", () => {
    apiMocks.useReview.mockReturnValue({
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
    });

    const { lastFrame } = renderReviewScreen({
      screen: "review",
      reviewId: "review-123",
      mode: "staged",
      live: true,
    });

    expect(lastFrame()).toMatch(/progress overview/i);
    expect(apiMocks.useReview).toHaveBeenCalledWith("");
  });

  test("shows the loading state for a pending saved-review read on the default non-live route", () => {
    apiMocks.useReview.mockReturnValue({
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
    });

    const { lastFrame } = renderReviewScreen();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Loading review...");
    expect(frame).not.toMatch(/progress overview/i);
  });

  test("live active-session resume ignores saved-review read errors", () => {
    apiMocks.useReview.mockReturnValue({
      isSuccess: false,
      isError: true,
      data: undefined,
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
    apiMocks.useReviewLifecycleBase.mockImplementation((options) =>
      makeReviewLifecycleBase({
        gate: options.isConfigured || options.allowResumeWithoutSetup ? "running" : "unconfigured",
        isStreaming: true,
      }),
    );
    apiMocks.useReview.mockReturnValue({
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
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

    expect(fresh.lastFrame()).toMatch(/model required|api key/i);
    expect(apiMocks.createReview).not.toHaveBeenCalled();
  });
});

function renderReviewScreen(
  initialRoute: Route = { screen: "review", reviewId: "review-123", mode: "staged" },
) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <TerminalKeyboardProvider>
        <NavigationProvider initialRoute={initialRoute}>
          <FooterProvider initialShortcuts={[]}>
            <ReviewScreen />
          </FooterProvider>
        </NavigationProvider>
      </TerminalKeyboardProvider>
    </CliThemeProvider>,
  );
}
