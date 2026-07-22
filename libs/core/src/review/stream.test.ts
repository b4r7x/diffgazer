import { describe, expect, it } from "vitest";
import { processReviewStream } from "./stream.js";

function createSSEReader(events: unknown[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return stream.getReader();
}

const reviewResult = {
  issues: [],
};

const agentStarted = {
  type: "agent_start",
  agent: {
    id: "detective",
    name: "Detective",
    lens: "correctness",
    badgeLabel: "DET",
    badgeVariant: "info",
    description: "Finds bugs",
  },
  timestamp: "2025-01-01T00:00:00Z",
};

describe("processReviewStream", () => {
  it("returns the complete review result and collected agent events", async () => {
    const result = await processReviewStream(
      createSSEReader([agentStarted, { type: "complete", reviewId: "r1", result: reviewResult }]),
      {},
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        reviewId: "r1",
        result: reviewResult,
        agentEvents: [expect.objectContaining({ type: "agent_start" })],
      });
    }
  });

  it("returns stream errors from error events and incomplete streams", async () => {
    const errorResult = await processReviewStream(
      createSSEReader([{ type: "error", error: { code: "AI_ERROR", message: "AI failed" } }]),
      {},
    );

    expect(errorResult.ok).toBe(false);
    if (!errorResult.ok) {
      expect(errorResult.error).toEqual({ code: "AI_ERROR", message: "AI failed" });
    }

    const incompleteResult = await processReviewStream(
      createSSEReader([
        {
          type: "review_started",
          reviewId: "r1",
          filesTotal: 3,
          timestamp: "2025-01-01T00:00:00Z",
        },
      ]),
      {},
    );

    expect(incompleteResult.ok).toBe(false);
    if (!incompleteResult.ok) {
      expect(incompleteResult.error).toEqual({
        code: "STREAM_ERROR",
        message: "Stream ended without complete event",
      });
    }
  });

  it("forwards step, agent, and chunk events", async () => {
    const stepEvents: unknown[] = [];
    const agentEvents: unknown[] = [];
    const chunks: string[] = [];

    const result = await processReviewStream(
      createSSEReader([
        {
          type: "review_started",
          reviewId: "r1",
          filesTotal: 5,
          timestamp: "2025-01-01T00:00:00Z",
        },
        { type: "step_start", step: "diff", timestamp: "2025-01-01T00:00:00Z" },
        { type: "step_complete", step: "diff", timestamp: "2025-01-01T00:00:01Z" },
        agentStarted,
        { type: "chunk", content: "partial" },
        { type: "complete", reviewId: "r1", result: reviewResult },
      ]),
      {
        onStepEvent: (event) => stepEvents.push(event),
        onAgentEvent: (event) => agentEvents.push(event),
        onChunk: (content) => chunks.push(content),
      },
    );

    expect(result.ok).toBe(true);
    expect(stepEvents).toEqual([
      expect.objectContaining({ type: "review_started", reviewId: "r1" }),
      expect.objectContaining({ type: "step_start", step: "diff" }),
      expect.objectContaining({ type: "step_complete", step: "diff" }),
    ]);
    expect(agentEvents).toEqual([expect.objectContaining({ type: "agent_start" })]);
    expect(chunks).toEqual(["partial"]);
  });
});
