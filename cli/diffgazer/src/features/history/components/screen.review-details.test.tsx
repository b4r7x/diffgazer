import type { BoundApi } from "@diffgazer/core/api";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type {
  ReviewIssue,
  ReviewListWarning,
  ReviewResponse,
} from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue, makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation";
import { useNavigation } from "../../../hooks/use-navigation";
import { buildResponsiveResult, getBreakpointTier } from "../../../lib/breakpoints";
import { flush } from "../../../testing/flush";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { HistoryScreen } from "./screen";

const terminalSize = vi.hoisted(() => ({ columns: 100, rows: 30 }));
const MIXED_VISIBLE_SALVAGED_ID = "abcdef00-0000-4000-8000-000000000000";
const MIXED_WARNING_ONLY_COLLIDER_ID = "abcdef00-0000-4000-8000-000000000001";

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useConfigurationInit: () => ({ data: undefined, isLoading: false }),
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
    contentColumns: terminalSize.columns,
    contentRows: terminalSize.rows - 4,
  }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
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

function renderHistoryScreen(
  getReview: BoundApi["getReview"],
  listedRun = makeReviewMetadata({
    id: REVIEW_ID,
    issueCount: 1,
    highCount: 1,
    durationMs: 252_000,
  }),
) {
  const getReviews = vi.fn<BoundApi["getReviews"]>().mockResolvedValue({ reviews: [listedRun] });
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

function makeMixedWarnings(): ReviewListWarning[] {
  const mixedIds = Array.from(
    { length: 48 },
    (_, index) => `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
  );
  const mixedWarnings = mixedIds.flatMap<ReviewListWarning>((reviewId) => [
    { kind: "unreadable_review", reviewId },
    { kind: "invalid_issues_dropped", reviewId, count: 1 },
  ]);

  return [
    { kind: "invalid_issues_dropped", reviewId: MIXED_VISIBLE_SALVAGED_ID, count: 1 },
    { kind: "unreadable_review", reviewId: MIXED_WARNING_ONLY_COLLIDER_ID },
    ...mixedWarnings,
  ];
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

  test("qualifies a zero-issue run's pass by the floor the saved record kept", async () => {
    const cleanRun = makeReviewMetadata({ id: REVIEW_ID, issueCount: 0, durationMs: 8200 });
    const getReview = vi.fn<BoundApi["getReview"]>().mockResolvedValue({
      review: {
        ...makeReviewResponse([]).review,
        metadata: cleanRun,
        droppedBelowThreshold: 4,
        minSeverity: "medium",
      },
    });
    const { lastFrame } = renderHistoryScreen(getReview, cleanRun);

    await waitUntil(() => (lastFrame() ?? "").includes("No issues at or above medium"));
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("Passed — no issues found");
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

  test("shows a passed run its receipt line instead of five zero bars, and opens its summary", async () => {
    const getReview = vi.fn<BoundApi["getReview"]>().mockResolvedValue(makeReviewResponse([]));
    const { stdin, lastFrame } = renderHistoryScreen(
      getReview,
      makeReviewMetadata({
        id: REVIEW_ID,
        issueCount: 0,
        fileCount: 12,
        lenses: ["correctness", "security", "tests"],
        durationMs: 8200,
      }),
    );

    await waitUntil(() => (lastFrame() ?? "").includes("Passed — no issues found"));
    // The pane wraps the fact line, so it is matched on unwrapped text.
    const unwrapped = (lastFrame() ?? "").replace(/\s*│\s*/g, " ").replace(/\s+/g, " ");
    expect(unwrapped).toContain("No issues across 12 files · 3 lenses · 8s");
    expect(unwrapped).not.toContain("SEVERITY BREAKDOWN");

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
    expect(getReview).toHaveBeenCalledWith(REVIEW_ID, expect.any(AbortSignal));

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

    // The pane wraps prose, so the failure message is matched on unwrapped text.
    const unwrapped = () => (lastFrame() ?? "").replace(/\s*│\s*/g, " ").replace(/\s+/g, " ");
    await waitUntil(() => unwrapped().includes("disk unreadable"));

    const errorFrame = unwrapped();
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

  test("keeps the API-backed 50-target warning layout bounded at the 80 by 24 floor", async () => {
    Object.assign(terminalSize, { columns: 80, rows: 24 });
    const warnings = makeMixedWarnings();
    const getReviews = vi.fn<BoundApi["getReviews"]>().mockResolvedValue({
      reviews: [makeReviewMetadata({ id: MIXED_VISIBLE_SALVAGED_ID, issueCount: 1, highCount: 1 })],
      warnings,
    });
    const getReview = vi.fn<BoundApi["getReview"]>().mockResolvedValue(makeReviewResponse([]));
    const { Wrapper: QueryWrapper } = createTestQueryWrapper({ api: { getReviews, getReview } });
    const view = renderRootFrame(
      80,
      24,
      <QueryWrapper>
        <HistoryScreen />
      </QueryWrapper>,
    );

    await waitUntil(() =>
      (view.lastFrame() ?? "").includes("Press w to view all affected run IDs."),
    );

    const collapsedFrame = stripAnsi(view.lastFrame() ?? "");
    const assertPaneBottomsBeforeFooter = (frame: string, footerLabel: string) => {
      const lines = frame.split("\n");
      const footerIndex = lines.findIndex((line) => line.includes(footerLabel));
      const paneBottomIndex = lines.findLastIndex((line) => line.includes("┗"));
      expect(footerIndex).toBeGreaterThan(paneBottomIndex);
      expect(footerIndex).toBe(lines.length - 1);
      expect(lines[paneBottomIndex]).not.toContain(footerLabel);
      expect(lines[paneBottomIndex]).toMatch(/└─+┘.*┗[━─]+┛.*└─+┘/);
    };

    const getWarningDetailPanel = (frame: string) => {
      const lines = frame.split("\n");
      const titleIndex = lines.findIndex((line) =>
        line.includes("History warning · All affected run IDs"),
      );
      const bottomIndex = lines.findIndex(
        (line, index) => index > titleIndex && /^\s*└─+┘\s*$/.test(line),
      );
      if (titleIndex < 0 || bottomIndex < 0) throw new Error("Missing warning detail panel");
      return lines.slice(titleIndex, bottomIndex + 1).join("\n");
    };

    const assertDetailFrame = (frame: string, targetId: string) => {
      assertPaneBottomsBeforeFooter(frame, "Scroll IDs");
      expect(frame.split("\n")).toHaveLength(24);
      expect(frame).toContain("History warning · All affected run IDs");
      expect(frame).toContain(MIXED_VISIBLE_SALVAGED_ID);
      const detailRemediation = "Press w or Esc to hide IDs.";
      expect(frame).toContain(detailRemediation);
      expect(frame).toContain("Search ID, branch, path, staged");
      expect(frame).toContain("[Omitted]");
      expect(frame).toContain("Scroll IDs");
      expect(frame).toContain("Hide IDs");
      expect(frame).toContain("Close IDs");
      expect(getWarningDetailPanel(frame)).toContain(targetId);
    };

    assertPaneBottomsBeforeFooter(collapsedFrame, "Open Review");
    expect(collapsedFrame).toContain("History warning");
    expect(collapsedFrame).toContain(MIXED_VISIBLE_SALVAGED_ID);
    expect(collapsedFrame).toContain("Re-run the affected reviews for complete results.");
    expect(collapsedFrame).toContain("Press w to view all affected run IDs.");
    expect(collapsedFrame).toContain("[Omitted]");
    expect(collapsedFrame).toContain("Open Review");
    expect(collapsedFrame).toContain("Search");
    expect(collapsedFrame.split("\n")).toHaveLength(24);

    const collapsedLines = collapsedFrame.split("\n");
    const warningLine = collapsedLines.findIndex((line) => line.includes("History warning"));
    const searchLine = collapsedLines.findIndex((line) =>
      line.includes("Search ID, branch, path, staged"),
    );
    const runsLine = collapsedLines.findIndex((line) => line.includes("RUNS"));
    const salvageLine = collapsedLines.findIndex((line) => line.includes("[Omitted]"));
    expect(warningLine).toBeGreaterThanOrEqual(0);
    expect(searchLine).toBeGreaterThan(warningLine);
    expect(runsLine).toBeGreaterThan(searchLine);
    expect(salvageLine).toBeGreaterThan(runsLine);

    view.stdin.write("w");
    await waitUntil(() =>
      (view.lastFrame() ?? "").includes("History warning · All affected run IDs"),
    );
    await flush();

    const detailFrame = stripAnsi(view.lastFrame() ?? "");
    assertDetailFrame(detailFrame, MIXED_WARNING_ONLY_COLLIDER_ID);
    const initialWarningDetailPanel = getWarningDetailPanel(detailFrame);
    expect(initialWarningDetailPanel).not.toContain(MIXED_VISIBLE_SALVAGED_ID);

    const detailLines = detailFrame.split("\n");
    const detailTitleLine = detailLines.findIndex((line) =>
      line.includes("History warning · All affected run IDs"),
    );
    const detailSearchLine = detailLines.findIndex((line) =>
      line.includes("Search ID, branch, path, staged"),
    );
    const detailRunsLine = detailLines.findIndex((line) => line.includes("RUNS"));
    const detailSalvageLine = detailLines.findIndex((line) => line.includes("[Omitted]"));
    expect(detailSearchLine).toBeGreaterThan(detailTitleLine);
    expect(detailRunsLine).toBeGreaterThan(detailSearchLine);
    expect(detailSalvageLine).toBeGreaterThan(detailRunsLine);

    view.stdin.write("\u001b[F");
    await flush();
    const tailDetailFrame = stripAnsi(view.lastFrame() ?? "");
    expect(getWarningDetailPanel(tailDetailFrame)).not.toContain(MIXED_WARNING_ONLY_COLLIDER_ID);
    assertDetailFrame(tailDetailFrame, MIXED_VISIBLE_SALVAGED_ID);
  });
});
