/** Shared status vocabulary for stepper-style progress components. */
export type StepStatus = "completed" | "active" | "pending" | "error" | "skipped" | "disabled";

/**
 * Statuses a horizontal stepper can hold. It derives status from the step's position relative to
 * the active one, so the error/skipped/disabled part of the vocabulary is unreachable there.
 */
export type HorizontalStepStatus = Extract<StepStatus, "completed" | "active" | "pending">;

/** All step statuses in their canonical variant-map order. */
export const STEP_STATUSES = [
  "pending",
  "active",
  "completed",
  "error",
  "skipped",
  "disabled",
] as const satisfies readonly StepStatus[];

/** Returns true when a step status may respond to user interaction. */
export function isStepInteractive(status: StepStatus): boolean {
  return status !== "disabled";
}
