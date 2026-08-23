import { z } from "zod";
import type { LIFECYCLE_STATUSES } from "./statuses.js";

const STEP_IDS = ["diff", "context", "review", "report"] as const;
export const StepIdSchema = z.enum(STEP_IDS);
export type StepId = z.infer<typeof StepIdSchema>;

export const STEP_METADATA: Record<StepId, { label: string; description: string }> = {
  diff: { label: "Collect diff", description: "Gathering code changes" },
  context: { label: "Project context", description: "Building repo graph and summary" },
  review: { label: "Review issues", description: "Analyzing with lenses" },
  report: { label: "Generate report", description: "Synthesizing final report" },
};

const StepStartEventSchema = z.object({
  type: z.literal("step_start"),
  step: StepIdSchema,
  timestamp: z.string(),
});

const StepCompleteEventSchema = z.object({
  type: z.literal("step_complete"),
  step: StepIdSchema,
  timestamp: z.string(),
});

const StepErrorEventSchema = z.object({
  type: z.literal("step_error"),
  step: StepIdSchema,
  error: z.string(),
  timestamp: z.string(),
});

const ReviewStartedEventSchema = z.object({
  type: z.literal("review_started"),
  reviewId: z.string(),
  filesTotal: z.int().nonnegative(),
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

// Step state for UI consumption. It is created here and never parsed from an
// untrusted boundary, so it is a plain type rather than a runtime schema.
export interface StepState {
  id: StepId;
  label: string;
  status: (typeof LIFECYCLE_STATUSES)[number];
}

export function createInitialSteps(): StepState[] {
  return STEP_IDS.map((id) => ({
    id,
    label: STEP_METADATA[id].label,
    status: "pending",
  }));
}
