import { FooterProvider } from "@diffgazer/core/footer";
import { AGENT_METADATA, type AgentState } from "@diffgazer/core/schemas/events";
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
          events={[]}
          fileProgress={{ total: 0, current: 0, currentFile: null, completed: [] }}
          isStreaming
          error={null}
          notices={[]}
          issuesFound={0}
          startedAt={null}
          completedAt={null}
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
  test.each([
    {
      errorCode: "MODEL_ERROR",
      failure: "1 agent failed: Guardian.",
    },
    {
      errorCode: "RATE_LIMITED",
      failure: "1 agent failed (rate limited): Guardian.",
    },
  ])("renders the warning classified by latest $errorCode lens stats", ({ errorCode, failure }) => {
    const failedAgent: AgentState = {
      id: "guardian",
      meta: AGENT_METADATA.guardian,
      status: "error",
      progress: 100,
      issueCount: 0,
    };

    const { lastFrame } = renderView({
      agents: [failedAgent],
      lensStats: [{ lensId: "security", issueCount: 0, status: "failed", errorCode }],
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain(failure);
    expect(frame).toContain("Results may");
    expect(frame).toContain("be incomplete.");
  });

  test("renders streamed server notices in the activity pane", () => {
    const { lastFrame } = renderView({
      notices: ["Event stream truncated: showing the first 500 events."],
    });

    expect(lastFrame() ?? "").toContain("Event stream truncated: showing the first 500 events.");
  });

  test("labels prompt inclusion without claiming model analysis is complete", () => {
    const { lastFrame } = renderView({
      fileProgress: {
        total: 2,
        current: 2,
        currentFile: null,
        completed: ["src/a.ts", "src/b.ts"],
      },
    });

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Prompt:2");
    expect(frame).not.toContain("Files processed");
  });

  test("uses the lifecycle completion timestamp after streaming completes", () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const completedAt = new Date("2026-01-01T00:00:02.500Z");
    vi.setSystemTime(new Date("2026-01-01T00:00:12.500Z"));

    const { lastFrame } = renderView({
      isStreaming: false,
      startedAt,
      completedAt,
    });

    expect(lastFrame() ?? "").toContain("Time: 00:02");
  });
});

describe("ReviewProgressView (TUI) elapsed time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test.each([
    { elapsed: 3_600_000, expected: "60:00" },
    { elapsed: 7_261_000, expected: "121:01" },
  ])("preserves total elapsed minutes at $elapsed ms", ({ elapsed, expected }) => {
    vi.useFakeTimers();

    const { lastFrame } = renderView({
      isStreaming: false,
      startedAt: new Date(Date.now() - elapsed),
      completedAt: new Date(),
    });

    expect(lastFrame() ?? "").toContain(`Time: ${expected}`);
  });
});
