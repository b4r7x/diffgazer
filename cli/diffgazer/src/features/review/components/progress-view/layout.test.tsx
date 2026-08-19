import { AGENT_METADATA, type AgentId, type AgentState } from "@diffgazer/core/schemas/events";
import type { ProgressStepWithSubstepsData } from "@diffgazer/core/schemas/presentation";
import { cleanup } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanupRootFrames, renderRootFrame } from "../../../../testing/render-root-frame";
import { makeAgent } from "../../testing/progress-view";
import { ReviewProgressView } from "./view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigurationInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.useRealTimers();
});

const DEFAULT_AGENTS: AgentId[] = ["detective", "guardian", "optimizer", "simplifier", "tester"];
const DEFAULT_STEPS: ProgressStepWithSubstepsData[] = [
  { id: "parse", label: "Parse diff", status: "completed" },
  { id: "context", label: "Build context", status: "completed" },
  { id: "review", label: "Run review agents", status: "active" },
  { id: "assemble", label: "Assemble report", status: "pending" },
  { id: "report", label: "Write report", status: "pending" },
];

const AGENT_NAMES = DEFAULT_AGENTS.map((id) => AGENT_METADATA[id].name);
const STEP_AND_AGENT_COUNTS = [3, 4, 5].flatMap((stepCount) =>
  [2, 3, 4, 5].map((agentCount) => [stepCount, agentCount] as const),
);

describe("ReviewProgressView (TUI) layout", () => {
  test.each(
    STEP_AND_AGENT_COUNTS,
  )("closes the metrics box over a named agent at 80x24 with %i steps and %i agents", async (stepCount, agentCount) => {
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewProgressView
        progressSteps={DEFAULT_STEPS.slice(0, stepCount)}
        agents={DEFAULT_AGENTS.slice(0, agentCount).map(makeAgent)}
        events={[]}
        fileProgress={{ total: 23, completed: [] }}
        isStreaming
        error={null}
        notices={[]}
        onCancel={vi.fn()}
        onBack={vi.fn()}
        issuesFound={4}
        startedAt={new Date("2026-01-01T00:00:00.000Z")}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("PROGRESS OVERVIEW"));
    const lines = stripAnsi(lastFrame() ?? "").split("\n");
    expect(lines).toHaveLength(24);
    // The metrics box sits at the bottom of the overview pane, so an
    // under-counted row reserve above it clips the last metric and the
    // closing border off the frame instead of shrinking the agent board.
    const elapsedRow = lines.findIndex((line) => line.includes("Elapsed:"));
    expect(elapsedRow).toBeGreaterThan(-1);
    expect(lines[elapsedRow + 1]?.trimStart().startsWith("└")).toBe(true);
    // Closing the box must not cost the roster. The board drops its pad rather
    // than disappear, and its last row goes to a named agent rather than to an
    // overflow count that says nothing about what the review is doing. Scoped
    // to the board's own rows so the activity pane cannot satisfy this.
    const boardRow = lines.findIndex((line) => line.includes("AGENT BOARD"));
    expect(boardRow).toBeGreaterThan(-1);
    const boardRows = lines.slice(
      boardRow,
      lines.findIndex((line) => line.trimStart().startsWith("┌")),
    );
    expect(boardRows.some((line) => AGENT_NAMES.some((name) => line.includes(name)))).toBe(true);
  });

  test("fits realistic progress content into an 80 by 24 root frame", async () => {
    const agents = (["detective", "guardian", "optimizer", "simplifier", "tester"] as const).map(
      makeAgent,
    );
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewProgressView
        progressSteps={[
          { id: "context", label: "Build context", status: "completed" },
          { id: "review", label: "Review issues", status: "active" },
          { id: "report", label: "Build report", status: "pending" },
        ]}
        agents={agents}
        events={[]}
        fileProgress={{
          total: 12,
          completed: [],
        }}
        isStreaming
        error={null}
        notices={["One agent is waiting for capacity."]}
        onCancel={vi.fn()}
        onBack={vi.fn()}
        issuesFound={3}
        startedAt={new Date("2026-01-01T00:00:00.000Z")}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("Review issues"));
    const frame = lastFrame() ?? "";
    expect(frame.split("\n")).toHaveLength(24);
    expect(frame).not.toContain("reportqueued");
  });

  test("keeps the activity pane and actions visible in a narrow root frame", async () => {
    const { lastFrame } = renderRootFrame(
      60,
      24,
      <ReviewProgressView
        progressSteps={[
          { id: "context", label: "Build context", status: "completed" },
          { id: "review", label: "Review issues", status: "active" },
        ]}
        agents={[]}
        events={[
          {
            type: "agent_thinking",
            agent: "guardian",
            thought: "NARROW-ACTIVITY-VISIBLE",
            timestamp: "2026-01-01T00:00:01.000Z",
          },
        ]}
        fileProgress={{ total: 2, completed: [] }}
        isStreaming
        error={null}
        notices={[]}
        onCancel={vi.fn()}
        issuesFound={0}
        startedAt={null}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("NARROW-ACTIVITY-VISIBLE"));
    // One action surface: Cancel is published to the shortcut bar, never as a
    // second in-content button row.
    await vi.waitFor(() => expect(lastFrame()).toContain("[c] Cancel"));
    const frame = lastFrame() ?? "";
    expect(frame.split("Cancel")).toHaveLength(2);
    expect(frame.split("\n")).toHaveLength(24);
  });

  test("keeps the newest activity visible with notices and a partial-failure callout", async () => {
    const failedAgent: AgentState = {
      id: "guardian",
      meta: AGENT_METADATA.guardian,
      status: "error",
      progress: 100,
      issueCount: 0,
    };
    const events = Array.from({ length: 12 }, (_, index) => ({
      type: "agent_thinking" as const,
      agent: "guardian" as const,
      thought: `LOG-EVENT-${index + 1}`,
      timestamp: `2026-01-01T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
    }));
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewProgressView
        progressSteps={[{ id: "review", label: "Review issues", status: "active" }]}
        agents={[failedAgent]}
        lensStats={[{ lensId: "security", issueCount: 0, status: "failed" }]}
        events={events}
        fileProgress={{ total: 1, completed: [] }}
        isStreaming
        error={null}
        notices={["Stream notice"]}
        onCancel={vi.fn()}
        issuesFound={0}
        startedAt={null}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("LOG-EVENT-12"));
    expect(lastFrame()?.split("\n")).toHaveLength(24);
  });

  test("degrades to a one-line ledger and announces the agents it cannot list at 60x24", async () => {
    const { lastFrame } = renderRootFrame(
      60,
      24,
      <ReviewProgressView
        progressSteps={DEFAULT_STEPS}
        agents={DEFAULT_AGENTS.slice(0, 3).map(makeAgent)}
        events={[]}
        fileProgress={{ total: 12, completed: [] }}
        isStreaming
        error={null}
        notices={[]}
        onCancel={vi.fn()}
        issuesFound={0}
        startedAt={new Date("2026-01-01T00:00:00.000Z")}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("PROGRESS OVERVIEW"));
    const lines = stripAnsi(lastFrame() ?? "").split("\n");

    expect(lines).toHaveLength(24);
    // No orphaned metrics box: a top border is never the last box row drawn.
    const orphanBox = lines.findIndex(
      (line, index) =>
        /^\s*┌─+┐\s*$/.test(line) &&
        !lines.slice(index + 1).some((row) => /^\s*└─+┘\s*$/.test(row)),
    );
    expect(orphanBox).toBe(-1);
    // Data that cannot be listed is announced, never silently dropped.
    expect(lines.some((line) => line.includes("3 agents running"))).toBe(true);
    expect(lines.some((line) => line.includes("Files in Prompt"))).toBe(true);
  });

  test("keeps the api-key recovery callout whole inside an 80 by 24 root frame", async () => {
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewProgressView
        progressSteps={DEFAULT_STEPS.slice(0, 3)}
        agents={DEFAULT_AGENTS.slice(0, 3).map(makeAgent)}
        events={[]}
        fileProgress={{ total: 12, completed: [] }}
        isStreaming={false}
        error="API-key rejected"
        transportFamily="hosted-api"
        notices={[]}
        onGoToSettings={vi.fn()}
        issuesFound={0}
        startedAt={new Date("2026-01-01T00:00:00.000Z")}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("API Key Error"));
    const lines = stripAnsi(lastFrame() ?? "").split("\n");

    expect(lines).toHaveLength(24);
    // The recovery line is the callout's third content row, so the reserve has
    // to pay for it: the callout keeps its closing border inside the frame.
    const recoveryRow = lines.findIndex((line) => line.includes("Press p — Configure Provider."));
    expect(recoveryRow).toBeGreaterThan(-1);
    expect(lines.slice(recoveryRow + 1).some((line) => line.includes("\u2518"))).toBe(true);
  });

  test("keeps the callout whole when the server error wraps past one row", async () => {
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewProgressView
        progressSteps={DEFAULT_STEPS.slice(0, 3)}
        agents={DEFAULT_AGENTS.slice(0, 3).map(makeAgent)}
        events={[]}
        fileProgress={{ total: 12, completed: [] }}
        isStreaming={false}
        error={`API-key rejected. ${"The provider returned a long diagnostic. ".repeat(4)}`}
        transportFamily="hosted-api"
        notices={[]}
        onGoToSettings={vi.fn()}
        issuesFound={0}
        startedAt={new Date("2026-01-01T00:00:00.000Z")}
        completedAt={null}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("API Key Error"));
    const lines = stripAnsi(lastFrame() ?? "").split("\n");

    expect(lines).toHaveLength(24);
    const recoveryRow = lines.findIndex((line) => line.includes("Press p — Configure Provider."));
    expect(recoveryRow).toBeGreaterThan(-1);
    expect(lines.slice(recoveryRow + 1).some((line) => line.includes("\u2518"))).toBe(true);
  });
});
