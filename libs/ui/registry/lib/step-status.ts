/** Shared status vocabulary for stepper-style progress components. */
export type StepStatus = "completed" | "active" | "pending" | "error" | "skipped" | "disabled";

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
