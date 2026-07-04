import { FooterProvider } from "@diffgazer/core/footer";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CliThemeProvider } from "../../../theme/provider";
import { ReviewProgressView, type ReviewProgressViewProps } from "./progress-view";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderViewNode(overrides: Partial<ReviewProgressViewProps> = {}) {
  return (
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewProgressView
          progressSteps={[{ id: "parse", label: "Parse diff", status: "completed" }]}
          agents={[]}
          logEntries={[]}
          fileProgress={{ total: 0, current: 0, currentFile: null, completed: [] }}
          isStreaming
          error={null}
          notices={[]}
          issuesFound={0}
          startedAt={null}
          {...overrides}
        />
      </CliThemeProvider>
    </FooterProvider>
  );
}

function renderView(overrides: Partial<ReviewProgressViewProps> = {}) {
  return render(renderViewNode(overrides));
}

describe("ReviewProgressView (TUI) notices", () => {
  test("renders streamed server notices in the activity pane", () => {
    const { lastFrame } = renderView({
      notices: ["Event stream truncated: showing the first 500 events."],
    });

    expect(lastFrame() ?? "").toContain("Event stream truncated: showing the first 500 events.");
  });

  test("freezes elapsed time after streaming completes", async () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date("2026-01-01T00:00:02.500Z"));

    const { lastFrame, rerender } = renderView({
      isStreaming: false,
      startedAt,
    });

    expect(lastFrame() ?? "").toContain("Time: 00:02");

    await vi.runOnlyPendingTimersAsync();
    vi.setSystemTime(new Date("2026-01-01T00:00:12.500Z"));
    rerender(
      renderViewNode({
        isStreaming: false,
        startedAt,
      }),
    );

    expect(lastFrame() ?? "").toContain("Time: 00:02");
  });
});
