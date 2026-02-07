import { type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { StepperStep, type StepStatus } from "./stepper-step";
import type { SubstepData } from "./stepper-substep";

export interface StepData {
  id: string;
  label: string;
  status: StepStatus;
  substeps?: SubstepData[];
  content?: ReactNode;
}

export interface StepperProps {
  steps: StepData[];
  expandedIds?: string[];
  onToggle?: (id: string) => void;
  className?: string;
}

export function Stepper({
  steps,
  expandedIds = [],
  onToggle,
  className,
}: StepperProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {steps.map((step) => (
        <StepperStep
          key={step.id}
          stepId={step.id}
          label={step.label}
          status={step.status}
          substeps={step.substeps}
          isExpanded={expandedIds.includes(step.id)}
          onToggle={onToggle}
        >
          {step.content}
        </StepperStep>
      ))}
    </div>
  );
}
