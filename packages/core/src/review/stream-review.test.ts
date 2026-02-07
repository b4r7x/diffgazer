import { describe, it, expect, vi } from "vitest";
import { buildReviewQueryParams, processReviewStream } from "./stream-review.js";

describe("buildReviewQueryParams", () => {
  it("defaults mode to unstaged", () => {
    const params = buildReviewQueryParams({});

    expect(params.mode).toBe("unstaged");
  });

  it("uses provided mode", () => {
    const params = buildReviewQueryParams({ mode: "staged" });

    expect(params.mode).toBe("staged");
  });

  it("joins files with commas", () => {
    const params = buildReviewQueryParams({ files: ["a.ts", "b.ts"] });

    expect(params.files).toBe("a.ts,b.ts");
  });

  it("omits files when empty array", () => {
    const params = buildReviewQueryParams({ files: [] });

    expect(params.files).toBeUndefined();
  });

  it("omits files when undefined", () => {
    const params = buildReviewQueryParams({});

    expect(params.files).toBeUndefined();
  });

  it("joins lenses with commas", () => {
    const params = buildReviewQueryParams({ lenses: ["correctness", "security"] });

    expect(params.lenses).toBe("correctness,security");
  });

  it("omits lenses when empty array", () => {
    const params = buildReviewQueryParams({ lenses: [] });

    expect(params.lenses).toBeUndefined();
  });

  it("includes profile when provided", () => {
    const params = buildReviewQueryParams({ profile: "thorough" });

    expect(params.profile).toBe("thorough");
  });

  it("omits profile when undefined", () => {
    const params = buildReviewQueryParams({});

    expect(params.profile).toBeUndefined();
  });

  it("builds params with all options", () => {
    const params = buildReviewQueryParams({
      mode: "files",
      files: ["x.ts"],
      lenses: ["security"],
      profile: "quick",
    });

    expect(params).toEqual({
      mode: "files",
      files: "x.ts",
      lenses: "security",
      profile: "quick",
    });
  });
});

function createSSEReader(events: unknown[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
  return stream.getReader();
}

describe("processReviewStream", () => {
  const mockReviewResult = {
    summary: "All good",
    issues: [],
  };

  it("should return ok result with reviewResult and reviewId on complete event", async () => {
    const reader = createSSEReader([
      { type: "complete", reviewId: "r1", result: mockReviewResult },
    ]);

    const result = await processReviewStream(reader, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.reviewId).toBe("r1");
      expect(result.value.result).toEqual(mockReviewResult);
    }
  });

  it("should return err result when error event is received", async () => {
    const reader = createSSEReader([
      { type: "error", error: { code: "AI_ERROR", message: "AI failed" } },
    ]);

    const result = await processReviewStream(reader, {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AI_ERROR");
      expect(result.error.message).toBe("AI failed");
    }
  });

  it("should return STREAM_ERROR when stream ends without complete event", async () => {
    const reader = createSSEReader([
      { type: "review_started", reviewId: "r1", filesTotal: 3, timestamp: "2025-01-01T00:00:00Z" },
    ]);

    const result = await processReviewStream(reader, {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STREAM_ERROR");
      expect(result.error.message).toBe("Stream ended without complete event");
    }
  });

  it("should collect agent events in agentEvents array", async () => {
    const agentEvent = {
      type: "agent_start",
      agent: { id: "detective", name: "Detective", lens: "correctness", badgeLabel: "DET", badgeVariant: "info", description: "Finds bugs" },
      timestamp: "2025-01-01T00:00:00Z",
    };
    const reader = createSSEReader([
      agentEvent,
      { type: "complete", reviewId: "r1", result: mockReviewResult },
    ]);

    const result = await processReviewStream(reader, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.agentEvents).toHaveLength(1);
      expect(result.value.agentEvents[0].type).toBe("agent_start");
    }
  });

  it("should call onStepEvent for review_started event", async () => {
    const onStepEvent = vi.fn();
    const reader = createSSEReader([
      { type: "review_started", reviewId: "r1", filesTotal: 5, timestamp: "2025-01-01T00:00:00Z" },
      { type: "complete", reviewId: "r1", result: mockReviewResult },
    ]);

    await processReviewStream(reader, { onStepEvent });

    expect(onStepEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "review_started", reviewId: "r1" })
    );
  });

  it("should forward step events to onStepEvent callback", async () => {
    const onStepEvent = vi.fn();
    const reader = createSSEReader([
      { type: "step_start", step: "diff", timestamp: "2025-01-01T00:00:00Z" },
      { type: "step_complete", step: "diff", timestamp: "2025-01-01T00:00:01Z" },
      { type: "complete", reviewId: "r1", result: mockReviewResult },
    ]);

    await processReviewStream(reader, { onStepEvent });

    expect(onStepEvent).toHaveBeenCalledTimes(2);
  });

  it("should forward enrich events to onEnrichEvent callback", async () => {
    const onEnrichEvent = vi.fn();
    const reader = createSSEReader([
      { type: "enrich_progress", issueId: "i1", enrichmentType: "blame", status: "started", timestamp: "2025-01-01T00:00:00Z" },
      { type: "complete", reviewId: "r1", result: mockReviewResult },
    ]);

    await processReviewStream(reader, { onEnrichEvent });

    expect(onEnrichEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "enrich_progress", issueId: "i1" })
    );
  });

  it("should forward agent events to onAgentEvent callback", async () => {
    const onAgentEvent = vi.fn();
    const reader = createSSEReader([
      {
        type: "agent_start",
        agent: { id: "detective", name: "Detective", lens: "correctness", badgeLabel: "DET", badgeVariant: "info", description: "Finds bugs" },
        timestamp: "2025-01-01T00:00:00Z",
      },
      { type: "complete", reviewId: "r1", result: mockReviewResult },
    ]);

    await processReviewStream(reader, { onAgentEvent });

    expect(onAgentEvent).toHaveBeenCalledTimes(1);
    expect(onAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "agent_start" })
    );
  });
});
