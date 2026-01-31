import { z } from "zod";

// Step IDs match the workflow phases
export const STEP_IDS = ["diff", "triage"] as const;
export const StepIdSchema = z.enum(STEP_IDS);
export type StepId = z.infer<typeof StepIdSchema>;

export const STEP_STATUS = ["pending", "active", "completed", "error"] as const;
export const StepStatusSchema = z.enum(STEP_STATUS);
export type StepStatus = z.infer<typeof StepStatusSchema>;

// Metadata for each step (labels, descriptions)
export const STEP_METADATA: Record<StepId, { label: string; description: string }> = {
  diff: { label: "Collect diff", description: "Gathering code changes" },
  triage: { label: "Triage issues", description: "Analyzing with lenses" },
};

// Step events emitted during triage
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

export const StepEventSchema = z.discriminatedUnion("type", [
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

// Helper to create initial steps array
export function createInitialSteps(): StepState[] {
  return STEP_IDS.map((id) => ({
    id,
    label: STEP_METADATA[id].label,
    status: "pending" as StepStatus,
  }));
}

// Type guard for step events
export function isStepEvent(event: unknown): event is StepEvent {
  if (!event || typeof event !== "object") return false;
  const type = (event as { type?: string }).type;
  return type === "step_start" || type === "step_complete" || type === "step_error";
}
