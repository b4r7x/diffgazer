import type { ProgressStepWithSubstepsData } from "@diffgazer/core/schemas/presentation";
import { Box } from "ink";
import { ProgressStep } from "./step";

export interface ProgressListProps {
  steps: ProgressStepWithSubstepsData[];
  /** Rows the list may spend. Below the full height it windows on the active step. */
  maxRows?: number;
}

function countRows(step: ProgressStepWithSubstepsData): number {
  return 1 + (step.substeps?.length ?? 0);
}

/**
 * The active step is the row the user is actually watching, so it anchors the
 * window: the list grows forward into what is still to come, then backward into
 * what is already done, and drops the rest rather than letting the pane clip an
 * arbitrary row out of the middle.
 */
function getVisibleSteps(
  steps: ProgressStepWithSubstepsData[],
  availableRows: number,
): ProgressStepWithSubstepsData[] {
  const rowsBetween = (from: number, to: number): number =>
    steps.slice(from, to).reduce((total, step) => total + countRows(step), 0);

  const activeIndex = Math.max(
    steps.findIndex((step) => step.status === "active"),
    0,
  );
  let start = activeIndex;
  let end = activeIndex + 1;

  while (end < steps.length && rowsBetween(start, end + 1) <= availableRows) end += 1;
  while (start > 0 && rowsBetween(start - 1, end) <= availableRows) start -= 1;

  return steps.slice(start, end);
}

export function ProgressList({ steps, maxRows }: ProgressListProps) {
  if (steps.length === 0) return null;

  const visibleSteps = maxRows === undefined ? steps : getVisibleSteps(steps, Math.max(maxRows, 1));

  return (
    <Box flexDirection="column">
      {visibleSteps.map((step) => (
        <ProgressStep
          key={step.id}
          name={step.label}
          status={step.status}
          substeps={step.substeps}
        />
      ))}
    </Box>
  );
}
