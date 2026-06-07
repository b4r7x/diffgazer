// disabled = gated by policy (locked); pending = not-yet-reached in order.
// skipped = intentionally bypassed (not the same as completed).
export type StepStatus = "completed" | "active" | "pending" | "error" | "skipped" | "disabled";

export const STEP_STATUSES = [
  "pending",
  "active",
  "completed",
  "error",
  "skipped",
  "disabled",
] as const satisfies readonly StepStatus[];

export function isStepInteractive(status: StepStatus): boolean {
  return status !== "disabled";
}
