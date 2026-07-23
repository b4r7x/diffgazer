import { makeIssue } from "@diffgazer/core/testing/factories";
import { canonicalReviewFixture } from "@diffgazer/core/testing/review-facts";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { ReviewSummaryView } from "./summary-view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
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

    await vi.waitFor(() => expect(lastFrame()).toContain("View Results (Enter)"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("REVIEW COMPLETE #REVIEW-1");
    expect(frame).toContain("Found 1 issue across 1 file with issues.");
    expect(frame).toContain("Leaky state update");
    expect(frame.split("\n")).toHaveLength(24);
    expectNoRepeatedDividerRows(frame);
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

    // The action-controls row is not overwritten by escaped preview content;
    // pre-fix it read "[[ View Results (Enter) ]pi-k[ Back (Esc) ] Provider key errors …".
    const actionRow = lines.find((line) => line.includes("View Results (Enter)"));
    expect(actionRow).toBeDefined();
    expect(actionRow).not.toContain("Provider");
    expect(actionRow).toContain("Back (Esc)");

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

    await vi.waitFor(() => expect(lastFrame()).toContain("View Results (Enter)"));
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
    expect(frame).toContain("View Results (Enter)");
    expect(frame.split("\n")).toHaveLength(24);
  });
});
