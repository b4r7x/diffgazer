import { describe, expect, it } from "vitest";
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
});
