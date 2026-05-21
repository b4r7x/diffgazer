/**
 * Canonical six-state lifecycle for Stepper and HorizontalStepper.
 *
 * `disabled` ≠ `pending` — a disabled step is gated by policy (cannot be
 * reached yet), whereas a pending step is simply not-yet-reached in linear
 * order. Keeping them distinct lets consumers express both "this step is
 * locked behind a feature flag" and "this step is the next one in the flow".
 *
 * `skipped` ≠ `completed` — a skipped step was intentionally bypassed (e.g.
 * an optional wizard step). Treating it as completed would corrupt downstream
 * data integrity. Renders with line-through and dim glyph.
 */
export type StepStatus =
  | "completed"
  | "active"
  | "pending"
  | "error"
  | "skipped"
  | "disabled";

/** All six canonical statuses, ordered for iteration in tests/docs. */
export const STEP_STATUSES = [
  "pending",
  "active",
  "completed",
  "error",
  "skipped",
  "disabled",
] as const satisfies readonly StepStatus[];

/** A step is interactive when it can receive focus and respond to activation. */
export function isStepInteractive(status: StepStatus): boolean {
  return status !== "disabled";
}
