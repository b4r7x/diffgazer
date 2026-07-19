import type { ProgressStatus } from "@diffgazer/core/schemas/presentation";
import { Stepper } from "@diffgazer/ui/components/stepper";
import { cva } from "class-variance-authority";

const progressStepVariants = cva("py-1", {
  variants: {
    status: {
      completed:
        "[&_button>span:first-child]:border-status-complete [&_button>span:first-child]:text-status-complete [&_button>span:last-child]:text-status-complete",
      active:
        "[&_button>span:first-child]:border-status-running [&_button>span:first-child]:bg-status-running [&_button>span:first-child]:text-background [&_button>span:last-child]:text-status-running",
      pending:
        "[&_button>span:first-child]:border-status-pending [&_button>span:first-child]:text-status-pending [&_button>span:last-child]:text-status-pending",
    },
  },
  defaultVariants: { status: "pending" },
});

export interface ProgressStepProps {
  label: string;
  status: ProgressStatus;
  stepId?: string;
}

export function ProgressStep({ label, status, stepId }: ProgressStepProps) {
  return (
    <Stepper.Step
      stepId={stepId ?? label}
      status={status}
      className={progressStepVariants({ status })}
    >
      <Stepper.Trigger disabled>{label}</Stepper.Trigger>
    </Stepper.Step>
  );
}
