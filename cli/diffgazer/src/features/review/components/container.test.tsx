import type { UseReviewLifecycleBaseResult } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { type ReactElement, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { useNavigation } from "../../../hooks/use-navigation";
import { CliThemeProvider } from "../../../theme/provider";

const apiMocks = vi.hoisted(() => ({
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
}));

import { ReviewContainer } from "./container";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  apiMocks.createReview.mockResolvedValue({ reviewId: "review-123" });
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

    return makeLifecycleBase();
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

function renderContainer() {
  return render(
    <CliThemeProvider initialTheme="dark">
      <TerminalKeyboardProvider>
        <NavigationProvider
          initialRoute={{ screen: "review", reviewId: "review-123", mode: "staged" }}
        >
          <FooterProvider initialShortcuts={[]}>
            <RouteHarness />
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
  });
});

function makeLifecycleBase(): UseReviewLifecycleBaseResult {
  return {
    stream: {
      stop: vi.fn(),
      abort: vi.fn(),
      cancel: vi.fn(async () => null),
      state: {
        steps: [{ id: "diff", label: "Diff", status: "completed" }],
        agents: [],
        issues: [makeIssue({ id: "issue-1", title: "Completed issue" })],
        events: [],
        fileProgress: { total: 1, current: 1, currentFile: null, completed: ["src/index.ts"] },
        notices: [],
        isStreaming: false,
        error: null,
        errorCode: null,
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
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
