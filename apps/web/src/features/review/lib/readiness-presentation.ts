import type { ReadinessAction } from "@diffgazer/core/schemas/config";

export const READINESS_ACTION_LABELS = {
  create: "Create configuration",
  inspect: "Inspect configuration",
  select: "Select model",
  test: "Test readiness",
  update: "Update configuration",
  delete: "Delete configuration",
} as const satisfies Record<ReadinessAction, string>;

export function getReadinessActionLabel(action: ReadinessAction): string {
  return READINESS_ACTION_LABELS[action];
}
