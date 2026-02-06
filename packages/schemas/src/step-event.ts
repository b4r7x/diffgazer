import { z } from "zod";

// Step IDs match the workflow phases
export const STEP_IDS = ["diff", "context", "review", "enrich", "report"] as const;
export const StepIdSchema = z.enum(STEP_IDS);
export type StepId = z.infer<typeof StepIdSchema>;

export const STEP_STATUS = ["pending", "active", "completed", "error"] as const;
export const StepStatusSchema = z.enum(STEP_STATUS);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const STEP_METADATA: Record<StepId, { label: string; description: string }> = {
  diff: { label: "Collect diff", description: "Gathering code changes" },
  context: { label: "Project context", description: "Building repo graph and summary" },
  review: { label: "Review issues", description: "Analyzing with lenses" },
  enrich: { label: "Enrich context", description: "Adding git blame and context" },
  report: { label: "Generate report", description: "Synthesizing final report" },
};

// Step events emitted during review
export const StepStartEventSchema = z.object({
  type: z.literal("step_start"),
  step: StepIdSchema,
  timestamp: z.string(),
});
export type StepStartEvent = z.infer<typeof StepStartEventSchema>;

export const StepCompleteEventSchema = z.object({
  type: z.literal("step_complete"),
  step: StepIdSchema,
  timestamp: z.string(),
});
export type StepCompleteEvent = z.infer<typeof StepCompleteEventSchema>;

export const StepErrorEventSchema = z.object({
  type: z.literal("step_error"),
  step: StepIdSchema,
  error: z.string(),
  timestamp: z.string(),
});
export type StepErrorEvent = z.infer<typeof StepErrorEventSchema>;

export const ReviewStartedEventSchema = z.object({
  type: z.literal("review_started"),
  reviewId: z.string(),
  filesTotal: z.number(),
  timestamp: z.string(),
});
export type ReviewStartedEvent = z.infer<typeof ReviewStartedEventSchema>;

export const StepEventSchema = z.discriminatedUnion("type", [
  ReviewStartedEventSchema,
  StepStartEventSchema,
  StepCompleteEventSchema,
  StepErrorEventSchema,
]);
export type StepEvent = z.infer<typeof StepEventSchema>;

// Step state for UI consumption
export const StepStateSchema = z.object({
  id: StepIdSchema,
  label: z.string(),
  status: StepStatusSchema,
});
export type StepState = z.infer<typeof StepStateSchema>;

export function createInitialSteps(): StepState[] {
  return STEP_IDS.map((id) => ({
    id,
    label: STEP_METADATA[id].label,
    status: "pending" as StepStatus,
  }));
}

export function isStepEvent(event: unknown): event is StepEvent {
  if (!event || typeof event !== "object") return false;
  const type = (event as { type?: string }).type;
  return (
    type === "review_started" ||
    type === "step_start" ||
    type === "step_complete" ||
    type === "step_error"
  );
}
