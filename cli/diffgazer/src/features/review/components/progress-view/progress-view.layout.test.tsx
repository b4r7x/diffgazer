import { AGENT_METADATA, type AgentState } from "@diffgazer/core/schemas/events";
import { cleanup } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanupRootFrames, renderRootFrame } from "../../../../testing/render-root-frame";
import { makeAgent } from "./progress-view.test-harness";
import { ReviewProgressView } from "./view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.useRealTimers();
});

describe("ReviewProgressView (TUI) layout", () => {
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
          current: 4,
          currentFile:
            "packages/review/src/generated/deeply/nested/current-file-with-a-long-name.typescript.ts",
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
        fileProgress={{ total: 2, current: 1, currentFile: "src/a.ts", completed: [] }}
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
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Cancel");
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
        fileProgress={{ total: 1, current: 1, currentFile: null, completed: [] }}
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
});
