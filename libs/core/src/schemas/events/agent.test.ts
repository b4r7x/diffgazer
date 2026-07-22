import { describe, expect, it } from "vitest";
import { AgentStreamEventSchema } from "./agent.js";

describe("AgentStreamEventSchema", () => {
  it("accepts legacy tracing metadata but strips it from parsed events", () => {
    const result = AgentStreamEventSchema.safeParse({
      type: "file_start",
      file: "src/example.ts",
      index: 0,
      total: 1,
      timestamp: "now",
      agent: "detective",
      scope: "agent",
      traceId: "legacy-trace",
      spanId: "legacy-span",
      parentSpanId: "legacy-parent-span",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      type: "file_start",
      file: "src/example.ts",
      index: 0,
      total: 1,
      timestamp: "now",
      agent: "detective",
      scope: "agent",
    });
  });

  it("validates the incomplete-provider-output diagnostic counter", () => {
    const event = {
      type: "orchestrator_complete",
      totalIssues: 1,
      lensStats: [{ lensId: "correctness", issueCount: 1, status: "success" }],
      filesAnalyzed: 1,
      droppedIncompleteProviderIssues: 2,
      timestamp: "now",
    };

    expect(AgentStreamEventSchema.safeParse(event).success).toBe(true);
    expect(AgentStreamEventSchema.safeParse({ ...event, summary: "Paid prose" }).success).toBe(
      false,
    );
    expect(
      AgentStreamEventSchema.safeParse({ ...event, droppedIncompleteProviderIssues: -1 }).success,
    ).toBe(false);
  });

  it.each([
    { type: "tool_call", agent: "detective", tool: "grep", input: "needle", timestamp: "now" },
    {
      type: "tool_result",
      agent: "detective",
      tool: "grep",
      timestamp: "now",
    },
    { type: "tool_start", agent: "detective", tool: "grep", input: "needle", timestamp: "now" },
    {
      type: "tool_end",
      agent: "detective",
      tool: "grep",
      status: "success",
      timestamp: "now",
    },
  ])("rejects the producerless $type event", (event) => {
    expect(AgentStreamEventSchema.safeParse(event).success).toBe(false);
  });
});
