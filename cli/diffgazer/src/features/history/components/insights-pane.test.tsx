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
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import type { HistoryDetailState } from "../types";
import { HistoryInsightsPane } from "./insights-pane";
import { HistoryScreen } from "./screen";

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => ({ columns: 100, rows: 30 }),
  useResponsive: () => ({
    columns: 100,
    rows: 30,
    isNarrow: false,
    isMedium: false,
  }),
}));

afterEach(() => {
  cleanup();
});

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
// OSC title-set sequence (ESC ] 0 ; ... BEL) embedded in a persisted issue title.
const MALICIOUS_TITLE = `${ESC}]0;HACK${BEL}Safe title`;
const MALICIOUS_ERROR = `${ESC}]0;HACK${BEL}disk unreadable`;
const REVIEW_ID = "11111111-1111-4111-8111-111111111111";
const SEVERITY_COUNTS = { blocker: 0, high: 1, medium: 0, low: 0, nit: 0 };

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
      drilldowns: [],
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

describe("HistoryInsightsPane (TUI)", () => {
  test("strips terminal escape sequences from persisted issue titles", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane
          runId="run-1"
          severityCounts={null}
          issues={[makeIssue({ id: "issue-1", title: MALICIOUS_TITLE })]}
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Safe title");
    expect(frame).not.toContain("HACK");
  });

  test("strips terminal escape sequences from the persisted run id", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane runId={`${ESC}]0;HACK${BEL}#a1b2`} severityCounts={null} issues={[]} />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("RUN #A1B2");
    expect(frame).not.toContain("HACK");
  });

  test("keeps metadata visible while review details load", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane
          runId="run-1"
          severityCounts={SEVERITY_COUNTS}
          issues={[]}
          detailState={{ status: "loading" }}
          duration="4m 12s"
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("SEVERITY BREAKDOWN");
    expect(frame).toContain("Loading review details...");
    expect(frame).toContain("4m 12s");
  });

  test("retries a detail error from the active pane without discarding metadata", async () => {
    const retry = vi.fn();
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane
          runId="run-1"
          severityCounts={SEVERITY_COUNTS}
          issues={[]}
          detailState={{ status: "error", message: MALICIOUS_ERROR, retry }}
          duration="4m 12s"
          isActive
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("SEVERITY BREAKDOWN");
    expect(frame).toContain("Could not load review details: disk unreadable");
    expect(frame).toContain("Press r to retry");
    expect(frame).toContain("4m 12s");
    expect(frame).not.toContain("HACK");

    stdin.write("r");
    await waitUntil(() => retry.mock.calls.length === 1);
  });

  test("ignores retry input while the pane is inactive", async () => {
    const retry = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane
          runId="run-1"
          severityCounts={SEVERITY_COUNTS}
          issues={[]}
          detailState={{ status: "error", message: "disk unreadable", retry }}
        />
      </CliThemeProvider>,
    );

    stdin.write("r");
    await new Promise((resolve) => setImmediate(resolve));

    expect(retry).not.toHaveBeenCalled();
  });

  test.each([
    ["loading", { status: "loading" }, [makeIssue({ id: "stale-loading" })]],
    [
      "error",
      { status: "error", message: "disk unreadable", retry: vi.fn() },
      [makeIssue({ id: "stale-error" })],
    ],
  ] satisfies Array<
    [string, HistoryDetailState, ReviewIssue[]]
  >)("ignores Enter while review details are %s", async (_state, detailState, issues) => {
    const onOpenReview = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane
          runId="run-1"
          severityCounts={SEVERITY_COUNTS}
          issues={issues}
          detailState={detailState}
          isActive
          onOpenReview={onOpenReview}
        />
      </CliThemeProvider>,
    );

    stdin.write("\r");
    await new Promise((resolve) => setImmediate(resolve));

    expect(onOpenReview).not.toHaveBeenCalled();
  });

  test("opens a ready zero-issue review from the active pane", async () => {
    const onOpenReview = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <HistoryInsightsPane
          runId="run-1"
          severityCounts={null}
          issues={[]}
          isActive
          onOpenReview={onOpenReview}
        />
      </CliThemeProvider>,
    );

    stdin.write("\r");
    await waitUntil(() => onOpenReview.mock.calls.length === 1);
  });
});

describe("HistoryScreen review details", () => {
  test("opens Insights as a run-level review action without attaching issue identity", async () => {
    const issue = makeIssue({ id: "loaded-issue", title: "Loaded detail issue" });
    const getReview = vi.fn<BoundApi["getReview"]>().mockResolvedValue(makeReviewResponse([issue]));
    const { stdin, lastFrame } = renderHistoryScreen(getReview);

    await waitUntil(() => (lastFrame() ?? "").includes("Loaded detail issue"));
    stdin.write("\t");
    await waitUntil(() => (lastFrame() ?? "").includes("Enter Open Review"));

    stdin.write("\r");

    await waitUntil(() => (lastFrame() ?? "").includes(`Route: review/${REVIEW_ID}/summary`));
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
    await waitUntil(() => (lastFrame() ?? "").includes("Loaded detail issue"));
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
    expect(errorFrame).toContain("Focus this pane, then press r");
    expect(errorFrame).toContain("to retry");

    stdin.write("\t");
    await waitUntil(() => (lastFrame() ?? "").includes("r Retry Details"));
    expect(lastFrame()).not.toContain("Enter Open Review");

    stdin.write("r");
    await waitUntil(() => getReview.mock.calls.length === 2);
    await waitUntil(() => (lastFrame() ?? "").includes("Retried detail"));

    const recoveredFrame = lastFrame() ?? "";
    expect(recoveredFrame).toContain("Footer: Tab Switch Pane | Enter Open Review | / Search");
    expect(recoveredFrame).not.toContain("Retry Details");
  });
});
