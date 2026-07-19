import { canonicalReviewFixture, reviewFacts } from "@diffgazer/core/testing/review-facts";
import stripAnsi from "strip-ansi";
import { afterEach, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

const RESULTS_DETAILS_COLUMN = 28;

afterEach(() => {
  cleanupRootFrames();
});

async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

function normalizeTerminalText(value: string): string {
  return value.replaceAll(/[\s─│┌┐└┘├┤┬┴┼╭╮╰╯]+/g, "");
}

function buildSearchableFrame(frames: string[]): string {
  return frames
    .flatMap((rawFrame) => {
      const frame = stripAnsi(rawFrame);
      const detailsPane = frame
        .split("\n")
        .map((line) => line.slice(RESULTS_DETAILS_COLUMN))
        .join("\n");
      return [normalizeTerminalText(frame), normalizeTerminalText(detailsPane)];
    })
    .join("");
}

test("renders every canonical review fact in ANSI-free 80x24 TUI frames", async () => {
  const fixture = canonicalReviewFixture;
  const facts = reviewFacts(fixture);
  const summary = renderRootFrame(
    80,
    24,
    <ReviewSummaryView
      issues={fixture.result.issues}
      reviewId={fixture.metadata.id}
      durationMs={fixture.metadata.durationMs}
      lensStats={fixture.lensStats}
      droppedDuplicates={fixture.droppedDuplicates}
      onContinue={vi.fn()}
    />,
  );
  const capturedFrames = [summary.lastFrame() ?? ""];

  for (let index = 0; index < 30; index += 1) {
    summary.stdin.write("\u001b[B");
    await flush();
    capturedFrames.push(summary.lastFrame() ?? "");
  }

  const results = renderRootFrame(
    80,
    24,
    <ReviewResultsView
      issues={fixture.result.issues}
      reviewId={fixture.metadata.id}
      droppedDuplicates={fixture.droppedDuplicates}
    />,
  );
  capturedFrames.push(results.lastFrame() ?? "");

  for (let index = 1; index < fixture.result.issues.length; index += 1) {
    results.stdin.write("\u001b[B");
    await flush();
    capturedFrames.push(results.lastFrame() ?? "");
  }

  const frame = buildSearchableFrame(capturedFrames);
  const assertedFacts = [
    facts.runId,
    ...facts.severityCounts.flatMap(({ label, count }) => [label, String(count)]),
    ...facts.issueTitles,
    ...facts.issueLocations,
    ...facts.categoryRows.map(({ label, count }) => `${label}${String(count)}`),
    ...facts.lensRows.map(({ label, issueCount }) => `${label}${String(issueCount)}`),
    ...(facts.duplicateCollapseNotice ? [facts.duplicateCollapseNotice] : []),
  ];

  for (const assertedFact of assertedFacts) {
    const fact = normalizeTerminalText(assertedFact);
    expect(frame).toContain(fact);
  }
  expect(stripAnsi(results.lastFrame() ?? "").split("\n")).toHaveLength(24);
});
