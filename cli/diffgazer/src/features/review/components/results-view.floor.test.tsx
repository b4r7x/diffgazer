import { makeIssue } from "@diffgazer/core/testing/factories";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { ReviewResultsView } from "./results-view";

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

function makeNarrowIssues() {
  return Array.from({ length: 8 }, (_, index) =>
    makeIssue({
      id: `narrow-${index + 1}`,
      severity: index === 0 ? "blocker" : "high",
      file: `cli/server/src/features/authentication/services/session-revocation-service-${index + 1}.ts`,
      title: `Session tokens remain valid after account revocation ${index + 1}`,
    }),
  );
}

function renderNarrowResults(columns: number, rows: number) {
  return renderRootFrame(
    columns,
    rows,
    <ReviewResultsView reviewId="narrow-floor" issues={makeNarrowIssues()} droppedDuplicates={3} />,
  );
}

test("keeps the 60x20 narrow results frame free of overlaid rows", async () => {
  const view = renderNarrowResults(60, 20);

  await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("ISSUES (8)"));
  const frame = stripAnsi(view.lastFrame() ?? "");

  expect(frame.split("\n")).toHaveLength(20);
  // Character bleed from two rows rendered at the same y (the "Explain" tab
  // showing through the badge-row gap rendered as "]E[").
  expect(frame).not.toContain("]E[");
  // Both details header rows render instead of being overlaid: the full title
  // only fits in the details pane (the list row truncates it), so its presence
  // proves the title row was not swallowed by overflowing chrome.
  expect(frame).toContain("Session tokens remain valid after account revocation 1");
  expect(frame).toContain("Location: ");
  // The tabs row is all-or-nothing: fully rendered or fully absent.
  const hasFullTabsRow = /Details\s+Explain/.test(frame);
  const hasAnyTabLabel = frame.includes("Details") || frame.includes("Explain");
  expect(hasAnyTabLabel).toBe(hasFullTabsRow);
});

test("shows the full tabs row at 60x24 where the narrow half-pane fits it", async () => {
  const view = renderNarrowResults(60, 24);

  await vi.waitFor(() => expect(view.lastFrame() ?? "").toContain("ISSUES (8)"));
  const frame = stripAnsi(view.lastFrame() ?? "");

  expect(frame.split("\n")).toHaveLength(24);
  expect(frame).not.toContain("]E[");
  expect(frame).toMatch(/Details\s+Explain/);
});

describe("ReviewResultsView root frame", () => {
  test("paints every results list row and keeps the 80x24 frame stable while navigating", async () => {
    const issues = Array.from({ length: 12 }, (_, index) =>
      makeIssue({
        id: `results-floor-${index + 1}`,
        severity: index === 0 ? "blocker" : "high",
        file: `packages/review/src/generated/deeply/nested/results-floor-${index + 1}.typescript.ts`,
        title: `RESULTS-FLOOR-${index + 1} long diagnostic title`,
      }),
    );
    const { stdin, lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewResultsView reviewId="results-floor" issues={issues} onBack={vi.fn()} />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("RESULTS-FLOOR-1"));
    const initialFrame = lastFrame() ?? "";
    const severityFilterRow = initialFrame.split("\n").find((row) => row.includes("B1 H11"));
    expect(severityFilterRow).toBeDefined();
    expect(severityFilterRow).not.toContain("[BLOCK");
    expect(initialFrame.split("\n")).toHaveLength(24);

    const paintedTitles = new Set(initialFrame.match(/RESULTS-FLOOR-\d+/g) ?? []);
    for (let index = 0; index < 11; index += 1) {
      stdin.write("\u001b[B");
      for (let render = 0; render < 4; render += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(lastFrame()?.split("\n")).toHaveLength(24);
      for (const title of lastFrame()?.match(/RESULTS-FLOOR-\d+/g) ?? []) {
        paintedTitles.add(title);
      }
    }
    await vi.waitFor(() => expect(lastFrame()).toContain("RESULTS-FLOOR-12"));
    const finalFrame = lastFrame() ?? "";
    expect(paintedTitles).toEqual(
      new Set(Array.from({ length: 12 }, (_, index) => `RESULTS-FLOOR-${index + 1}`)),
    );
    expect(finalFrame).toContain("RESULTS-FLOOR-12");
    expect(lastFrame()?.split("\n")).toHaveLength(24);
  });

  test.each([
    80, 100,
  ] as const)("keeps the %i-column results heading, data, and actions in a 24-row root frame", async (columns) => {
    const { lastFrame } = renderRootFrame(
      columns,
      24,
      <ReviewResultsView
        reviewId="review-1"
        issues={[makeIssue({ id: "1", title: "Leaky state update" })]}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("[Esc] Back"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Review #review-1");
    expect(frame).toContain("ISSUES (1)");
    expect(frame).toContain("Leaky state update");
    expect(frame.split("\n")).toHaveLength(24);
    expectNoRepeatedDividerRows(frame);
  });
});
