import { describe, expect, it } from "vitest";
import { AgentStreamEventSchema } from "./agent.js";
import * as publicEvents from "./index.js";
import * as stepEvents from "./step.js";
import { type StepEvent, StepEventSchema } from "./step.js";
import { FullReviewStreamEventSchema } from "./stream.js";

const completeStepEvents = [
  { type: "review_started", reviewId: "review-1", filesTotal: 2, timestamp: "now" },
  { type: "step_start", step: "diff", timestamp: "now" },
  { type: "step_complete", step: "context", timestamp: "now" },
  { type: "step_error", step: "review", error: "provider unavailable", timestamp: "now" },
] satisfies StepEvent[];

describe("StepEventSchema", () => {
  it.each(completeStepEvents)("accepts a complete $type event", (event) => {
    expect(StepEventSchema.safeParse(event)).toEqual({ success: true, data: event });
  });

  it.each([
    { type: "agent_thinking", agent: "detective", thought: "Reviewing", timestamp: "now" },
    { type: "file_start", file: "src/app.ts", index: 0, total: 1, timestamp: "now" },
  ])("rejects the complete non-step $type event", (event) => {
    expect(StepEventSchema.safeParse(event).success).toBe(false);
    expect(FullReviewStreamEventSchema.safeParse(event).success).toBe(true);
  });

  it.each([
    null,
    {},
    { type: "step_start" },
    { type: "step_error", step: "review", timestamp: "now" },
    { type: "step_complete", step: "unknown", timestamp: "now" },
  ])("rejects invalid unknown input at the stream schema boundary", (event) => {
    expect(FullReviewStreamEventSchema.safeParse(event).success).toBe(false);
  });

  it("does not expose an unknown-value step-event predicate", () => {
    expect(stepEvents).not.toHaveProperty("isStepEvent");
    expect(publicEvents).not.toHaveProperty("isStepEvent");
  });
});

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
