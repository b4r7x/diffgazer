import type { StepId } from "@diffgazer/core/schemas/events";

export function stepStart(step: StepId): {
  type: "step_start";
  step: StepId;
  timestamp: string;
} {
  return {
    type: "step_start",
    step,
    timestamp: new Date().toISOString(),
  };
}

export function stepComplete(step: StepId): {
  type: "step_complete";
  step: StepId;
  timestamp: string;
} {
  return {
    type: "step_complete",
    step,
    timestamp: new Date().toISOString(),
  };
}

export function stepError(
  step: StepId,
  error: string,
): { type: "step_error"; step: StepId; error: string; timestamp: string } {
  return {
    type: "step_error",
    step,
    error,
    timestamp: new Date().toISOString(),
  };
}
