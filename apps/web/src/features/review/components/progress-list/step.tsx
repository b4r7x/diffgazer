import type { ProgressStatus } from "@diffgazer/core/schemas/presentation";
import { Stepper } from "@diffgazer/ui/components/stepper";
import { cva } from "class-variance-authority";

// The run palette (--status-*) is app-owned, so the repaint lives here and reaches the
// Stepper through its public indicator/label class slots.
const progressIndicatorVariants = cva("", {
  variants: {
    status: {
      completed: "border-status-complete text-status-complete",
      active: "border-status-running bg-status-running text-background",
      pending: "border-status-pending text-status-pending",
    },
  },
  defaultVariants: { status: "pending" },
});

const progressLabelVariants = cva("", {
  variants: {
    status: {
      completed: "text-status-complete",
      active: "text-status-running",
      pending: "text-status-pending",
    },
  },
  defaultVariants: { status: "pending" },
});

export interface ProgressStepProps {
  label: string;
  status: ProgressStatus;
  stepId: string;
}

export function ProgressStep({ label, status, stepId }: ProgressStepProps) {
  return (
    <Stepper.Step stepId={stepId} status={status} className="py-1">
      <Stepper.Trigger
        disabled
        indicatorClassName={progressIndicatorVariants({ status })}
        labelClassName={progressLabelVariants({ status })}
      >
        {label}
      </Stepper.Trigger>
    </Stepper.Step>
  );
}
