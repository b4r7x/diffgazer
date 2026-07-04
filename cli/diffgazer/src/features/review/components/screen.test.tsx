import type { UseReviewLifecycleBaseResult } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";

const apiMocks = vi.hoisted(() => ({
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
}));

import { CliThemeProvider } from "../../../theme/provider";
import { ReviewScreen } from "./screen";

afterEach(() => {
  cleanup();
});

describe("ReviewScreen", () => {
  beforeEach(() => {
    apiMocks.createReview.mockReset();
    apiMocks.useCreateReview.mockReturnValue({ mutateAsync: apiMocks.createReview });
    apiMocks.useInit.mockReturnValue({
      data: {
        config: { provider: "gemini", model: "gemini-2.5-flash" },
        configured: true,
      },
      isLoading: false,
    });
    apiMocks.useReview.mockReset();
    apiMocks.useReviewLifecycleBase.mockReturnValue(makeLifecycleBase());
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
    expect(frame).toContain("Found 0 issues across 0 files.");
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
});

function renderReviewScreen() {
  return render(
    <CliThemeProvider initialTheme="dark">
      <TerminalKeyboardProvider>
        <NavigationProvider
          initialRoute={{ screen: "review", reviewId: "review-123", mode: "staged" }}
        >
          <FooterProvider initialShortcuts={[]}>
            <ReviewScreen />
          </FooterProvider>
        </NavigationProvider>
      </TerminalKeyboardProvider>
    </CliThemeProvider>,
  );
}

function makeLifecycleBase(): UseReviewLifecycleBaseResult {
  return {
    stream: {
      stop: vi.fn(),
      abort: vi.fn(),
      cancel: vi.fn(async () => null),
      state: {
        steps: [{ id: "diff", label: "Diff", status: "completed" }],
        agents: [],
        issues: [],
        events: [],
        fileProgress: { total: 0, current: 0, currentFile: null, completed: [] },
        notices: [],
        isStreaming: true,
        error: null,
        errorCode: null,
        startedAt: null,
        reviewId: "review-123",
      },
    },
    checks: { isNoDiffError: false, isCheckingForChanges: false, loadingMessage: null },
    completion: { isCompleting: false, skipDelay: vi.fn(), resetCompletion: vi.fn() },
    start: {
      hasStarted: true,
      hasStreamed: true,
      setHasStarted: vi.fn(),
      setHasStreamed: vi.fn(),
    },
    gate: "running",
    contextReady: false,
    contextSnapshot: null,
  };
}
