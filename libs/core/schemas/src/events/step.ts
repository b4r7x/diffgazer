import { z } from "zod";
import { LIFECYCLE_STATUSES } from "../shared/statuses.js";

// Step IDs match the workflow phases
export const STEP_IDS = ["diff", "context", "review", "enrich", "report"] as const;
export const StepIdSchema = z.enum(STEP_IDS);
export type StepId = z.infer<typeof StepIdSchema>;

const StepStatusSchema = z.enum(LIFECYCLE_STATUSES);
type StepStatus = z.infer<typeof StepStatusSchema>;

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

export const StepCompleteEventSchema = z.object({
  type: z.literal("step_complete"),
  step: StepIdSchema,
  timestamp: z.string(),
});

export const StepErrorEventSchema = z.object({
  type: z.literal("step_error"),
  step: StepIdSchema,
  error: z.string(),
  timestamp: z.string(),
});

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
const StepStateSchema = z.object({
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

const STEP_EVENT_TYPES = new Set<string>(["review_started", "step_start", "step_complete", "step_error"]);

export function isStepEvent(event: unknown): event is StepEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    typeof (event as { type: unknown }).type === "string" &&
    STEP_EVENT_TYPES.has((event as { type: string }).type)
  );
}
