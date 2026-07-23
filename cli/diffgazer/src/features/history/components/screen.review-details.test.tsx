import type { BoundApi } from "@diffgazer/core/api";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { ReviewIssue, ReviewResponse } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue, makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { useNavigation } from "../../../hooks/use-navigation";
import { buildResponsiveResult, getBreakpointTier } from "../../../lib/breakpoints";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { HistoryScreen } from "./screen";

const terminalSize = vi.hoisted(() => ({ columns: 100, rows: 30 }));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useInit: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalSize,
  useResponsive: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    ...buildResponsiveResult(getBreakpointTier(terminalSize.columns)),
  }),
}));

vi.mock("../../../components/layout/global", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../components/layout/global")>()),
  useContentZone: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    contentColumns: terminalSize.columns,
    contentRows: terminalSize.rows - 4,
  }),
}));

afterEach(() => {
  cleanup();
  terminalSize.columns = 100;
  terminalSize.rows = 30;
});

const REVIEW_ID = "11111111-1111-4111-8111-111111111111";

function makeReviewResponse(issues: ReviewIssue[]): ReviewResponse {
  return {
    review: {
      metadata: makeReviewMetadata({
        id: REVIEW_ID,
        issueCount: 1,
        highCount: 1,
        durationMs: 252_000,
      }),
      result: { issues },
      gitContext: {
        branch: "main",
        commit: "abc123",
        fileCount: 1,
        additions: 0,
        deletions: 0,
      },
    },
  };
}

function FooterProbe() {
  const { shortcuts } = useFooterData();
  return (
    <Text>{`Footer: ${shortcuts.map(({ key, label }) => `${key} ${label}`).join(" | ")}`}</Text>
  );
}

function RouteProbe() {
  const { route } = useNavigation();
  if (route.screen !== "review") return <Text>{`Route: ${route.screen}`}</Text>;
  return <Text>{`Route: review/${route.reviewId ?? "new"}/${route.issueId ?? "summary"}`}</Text>;
}

function renderHistoryScreen(getReview: BoundApi["getReview"]) {
  const getReviews = vi.fn<BoundApi["getReviews"]>().mockResolvedValue({
    reviews: [
      makeReviewMetadata({
        id: REVIEW_ID,
        issueCount: 1,
        highCount: 1,
        durationMs: 252_000,
      }),
    ],
  });
  const { Wrapper: QueryWrapper } = createTestQueryWrapper({
    api: { getReviews, getReview },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>
            <NavigationProvider initialRoute={{ screen: "history" }}>
              <FooterProvider initialShortcuts={[]}>{children}</FooterProvider>
            </NavigationProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </QueryWrapper>
    );
  }

  return render(
    <Wrapper>
      <HistoryScreen />
      <FooterProbe />
      <RouteProbe />
    </Wrapper>,
  );
}

describe("HistoryScreen review details", () => {
  test("opens the highlighted Insights issue directly", async () => {
    const issue = makeIssue({ id: "loaded-issue", title: "Loaded detail issue" });
    const getReview = vi.fn<BoundApi["getReview"]>().mockResolvedValue(makeReviewResponse([issue]));
    const { stdin, lastFrame } = renderHistoryScreen(getReview);

    await waitUntil(() => (lastFrame() ?? "").includes("Loaded detail"));
    stdin.write("\t");
    await waitUntil(() => (lastFrame() ?? "").includes("Enter Open Review"));

    stdin.write("\r");

    await waitUntil(() => (lastFrame() ?? "").includes(`Route: review/${REVIEW_ID}/loaded-issue`));
  });

  test("opens an active zero-issue Insights review exactly as its footer advertises", async () => {
    const getReview = vi.fn<BoundApi["getReview"]>().mockResolvedValue(makeReviewResponse([]));
    const { stdin, lastFrame } = renderHistoryScreen(getReview);

    await waitUntil(() => getReview.mock.calls.length === 1);
    stdin.write("\t");
    await waitUntil(() => (lastFrame() ?? "").includes("Enter Open Review"));

    stdin.write("\r");
    await waitUntil(() => (lastFrame() ?? "").includes(`Route: review/${REVIEW_ID}/summary`));
  });

  test("keeps saved metadata visible while the real detail query is pending", async () => {
    const detail = createDeferred<ReviewResponse>();
    const getReview = vi.fn<BoundApi["getReview"]>().mockReturnValue(detail.promise);
    const { stdin, lastFrame } = renderHistoryScreen(getReview);

    await waitUntil(() => (lastFrame() ?? "").includes("Loading review details..."));

    const pendingFrame = lastFrame() ?? "";
    expect(pendingFrame).toContain("SEVERITY BREAKDOWN");
    expect(pendingFrame).toContain("4m 12s");
    expect(getReview).toHaveBeenCalledWith(REVIEW_ID);

    stdin.write("\t");
    await waitUntil(() => (lastFrame() ?? "").includes("Footer: Tab Switch Pane | / Search"));

    const focusedPendingFrame = lastFrame() ?? "";
    expect(focusedPendingFrame).not.toContain("Enter Open Review");
    expect(focusedPendingFrame).not.toContain("Retry Details");

    detail.resolve(
      makeReviewResponse([makeIssue({ id: "loaded-issue", title: "Loaded detail issue" })]),
    );
    await waitUntil(() => (lastFrame() ?? "").includes("Loaded detail"));
  });

  test("shows a rejected detail request and retries it from the focused Insights pane", async () => {
    const getReview = vi
      .fn<BoundApi["getReview"]>()
      .mockRejectedValueOnce(new Error("disk unreadable"))
      .mockResolvedValueOnce(
        makeReviewResponse([makeIssue({ id: "retried-issue", title: "Retried detail issue" })]),
      );
    const { stdin, lastFrame } = renderHistoryScreen(getReview);

    await waitUntil(() => (lastFrame() ?? "").includes("disk unreadable"));

    const errorFrame = lastFrame() ?? "";
    expect(errorFrame).toContain("SEVERITY BREAKDOWN");
    expect(errorFrame).toContain("4m 12s");
    expect(errorFrame).toContain("Focus this pane, then press");
    expect(errorFrame).toContain("r to retry");

    stdin.write("\t");
    await waitUntil(() => (lastFrame() ?? "").includes("r Retry Details"));
    expect(lastFrame()).not.toContain("Enter Open Review");

    stdin.write("r");
    await waitUntil(() => getReview.mock.calls.length === 2);
    await waitUntil(() => (lastFrame() ?? "").includes("Retried"));

    const recoveredFrame = lastFrame() ?? "";
    expect(recoveredFrame).toContain("Footer: Tab Switch Pane | Enter Open Review | / Search");
    expect(recoveredFrame).not.toContain("Retry Details");
  });
});
