import { makeIssue } from "@diffgazer/core/testing/factories";
import { canonicalReviewFixture } from "@diffgazer/core/testing/review-facts";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { ReviewSummaryView } from "./summary-view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigurationInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanupRootFrames();
});

function expectNoRepeatedDividerRows(frame: string): void {
  const dividerRows = frame
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /^─+$/.test(line));

  expect(dividerRows.length).toBeLessThanOrEqual(4);
}

describe("ReviewSummaryView root frame", () => {
  test.each([
    80, 100,
  ] as const)("keeps the %i-column summary heading, data, and actions in a 24-row root frame", async (columns) => {
    const issue = makeIssue({ id: "1", severity: "high", title: "Leaky state update" });
    const { lastFrame } = renderRootFrame(
      columns,
      24,
      <ReviewSummaryView
        issues={[issue]}
        reviewId="review-1"
        durationMs={1200}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("View Results"));
    const frame = lastFrame() ?? "";
    // One action surface: the footer names the action, the body never repeats it.
    expect(frame.split("View Results")).toHaveLength(2);
    expect(frame).not.toContain("(Enter)");
    expect(frame).toContain("REVIEW COMPLETE #REVIEW-1");
    expect(frame).toContain("Found 1 issue across 1 file with issues.");
    expect(frame).toContain("Leaky state update");
    expect(frame.split("\n")).toHaveLength(24);
    expectNoRepeatedDividerRows(frame);
  });

  test("lands the top-issue preview above the fold at 100x30", async () => {
    const fixture = canonicalReviewFixture;
    const firstIssue = fixture.result.issues[0];
    if (!firstIssue) throw new Error("canonical fixture has no issues");
    const { lastFrame } = renderRootFrame(
      100,
      30,
      <ReviewSummaryView
        issues={fixture.result.issues}
        reviewId={fixture.metadata.id}
        durationMs={fixture.metadata.durationMs}
        onContinue={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("SEVERITY BREAKDOWN"));
    const frame = stripAnsi(lastFrame() ?? "");

    expect(frame).toContain("TOP ISSUES PREVIEW");
    expect(frame).toContain(firstIssue.title.slice(0, 20));
  });

  test("spends at most three rows on the severity block at the 80x24 floor", async () => {
    const fixture = canonicalReviewFixture;
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewSummaryView
        issues={fixture.result.issues}
        reviewId={fixture.metadata.id}
        durationMs={fixture.metadata.durationMs}
        onContinue={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("SEVERITY BREAKDOWN"));
    const lines = stripAnsi(lastFrame() ?? "").split("\n");
    const start = lines.findIndex((line) => line.includes("SEVERITY BREAKDOWN"));
    const severityRows = lines
      .slice(start + 2)
      .filter((line) => /█|\[BLOCKER|\[NIT/.test(line)).length;

    // Was eight rows of half-empty bar tracks; counts now read from the legend.
    expect(severityRows).toBeLessThanOrEqual(3);
    expect(stripAnsi(lastFrame() ?? "")).toContain("[BLOCKER 1]");
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("░");
  });

  test("renders long top-issue previews as one row each at 100 columns", async () => {
    const issues = Array.from({ length: 3 }, (_, index) =>
      makeIssue({
        id: `summary-${index + 1}`,
        file: `packages/review/src/generated/deeply/nested/summary-${index + 1}.typescript.ts`,
        title: `SUMMARY-${index + 1} Generated review title with enough detail to overflow its preview row`,
      }),
    );
    const { lastFrame } = renderRootFrame(
      100,
      30,
      <ReviewSummaryView
        issues={issues}
        reviewId="review-summary"
        durationMs={1200}
        onContinue={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("SUMMARY-3"));
    const previewRows = (lastFrame() ?? "").split("\n").filter((line) => line.includes("SUMMARY-"));
    expect(previewRows).toHaveLength(3);
  });

  test("composites the scroll indicator and actions without overwriting content at 100x30", async () => {
    const fixture = canonicalReviewFixture;
    const { lastFrame } = renderRootFrame(
      100,
      30,
      <ReviewSummaryView
        issues={fixture.result.issues}
        reviewId={fixture.metadata.id}
        durationMs={fixture.metadata.durationMs}
        lensStats={fixture.lensStats}
        droppedDuplicates={fixture.droppedDuplicates}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("TOP ISSUES PREVIEW"));
    // Let the ScrollArea's content measurement settle so the scroll window (and
    // its down-indicator) reflects the overflowing content.
    for (let tick = 0; tick < 12; tick += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const lines = stripAnsi(lastFrame() ?? "").split("\n");

    // The content overflows at this size, so the down-scroll indicator is shown.
    // It renders on its own row; pre-fix it merged with a preview row that escaped
    // the ScrollArea clip (e.g. "▼BLOCKER] …").
    expect(lines.some((line) => line.includes("▼"))).toBe(true);
    for (const line of lines.filter((row) => row.includes("▼"))) {
      expect(line.trim()).toBe("▼");
    }

    // The footer is the only action surface and it is not overwritten by
    // escaped preview content; pre-fix an in-content button row read
    // "[[ View Results (Enter) ]pi-k[ Back (Esc) ] Provider key errors …".
    const actionRow = lines.find((line) => line.includes("View Results"));
    expect(actionRow).toBeDefined();
    expect(actionRow).not.toContain("Provider");
    expect(actionRow).toContain("Back");

    // The shortcut bar is the single action surface: an in-content button row
    // restating the same key would print the label a second time.
    expect(lines.filter((line) => line.includes("View Results"))).toHaveLength(1);
    expect(lines.filter((line) => line.includes("Back"))).toHaveLength(1);

    expect(lines).toHaveLength(30);
  });

  test("keeps summary actions visible with a realistic 80x24 issue floor", async () => {
    const issues = Array.from({ length: 12 }, (_, index) =>
      makeIssue({
        id: `summary-floor-${index + 1}`,
        severity: index < 3 ? "blocker" : "high",
        file: `packages/review/src/generated/deeply/nested/summary-floor-${index + 1}.typescript.ts`,
        title: `Summary floor issue ${index + 1} with a realistic long diagnostic title`,
      }),
    );
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewSummaryView
        issues={issues}
        reviewId="summary-floor"
        durationMs={1200}
        droppedDuplicates={2}
        droppedBelowThreshold={4}
        minSeverity="low"
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("View Results"));
    expect(lastFrame()?.split("\n")).toHaveLength(24);
  });

  test("scrolls overflowed summary sections while keeping actions visible", async () => {
    const issues = Array.from({ length: 12 }, (_, index) =>
      makeIssue({
        id: `summary-scroll-${index + 1}`,
        severity: index < 3 ? "blocker" : "high",
        title: `Summary scroll issue ${index + 1}`,
      }),
    );
    const { stdin, lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewSummaryView
        issues={issues}
        reviewId="summary-scroll"
        durationMs={1200}
        droppedBelowThreshold={4}
        minSeverity="low"
        lensStats={[
          { lensId: "correctness", issueCount: 6, status: "success" },
          { lensId: "security", issueCount: 6, status: "success" },
        ]}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(lastFrame() ?? "").not.toContain("4 below-threshold issues hidden");
    for (let index = 0; index < 30; index += 1) {
      stdin.write("\u001b[B");
      await new Promise((resolve) => setImmediate(resolve));
    }

    const frame = lastFrame() ?? "";
    expect(frame).toContain("4 below-threshold issues hidden");
    expect(frame).toContain("View Results");
    expect(frame.split("\n")).toHaveLength(24);
  });
});
