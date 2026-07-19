import { makeIssue } from "@diffgazer/core/testing/factories";
import stripAnsi from "strip-ansi";
import { afterEach, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { ReviewResultsView } from "./results-view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanupRootFrames();
});

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
