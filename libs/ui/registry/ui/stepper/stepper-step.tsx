"use client";

import { type ComponentProps, type ReactNode, useId, useMemo } from "react";
import { useStepperContext, StepperStepContext, type StepStatus } from "./stepper-context";

export interface StepperStepProps
  extends Omit<ComponentProps<"li">, "children"> {
  stepId: string;
  status: StepStatus;
  children: ReactNode;
}

export function StepperStep({
  stepId,
  status,
  children,
  className,
  ...props
}: StepperStepProps) {
  const { expandedIds } = useStepperContext();
  const isExpanded = expandedIds.includes(stepId);

  const base = useId();
  const triggerId = `${base}-trigger`;
  const contentId = `${base}-content`;

  const ctx = useMemo(() => ({ stepId, isExpanded, status, triggerId, contentId }), [stepId, isExpanded, status, triggerId, contentId]);

  return (
    <StepperStepContext value={ctx}>
      <li {...props} className={className} data-state={isExpanded ? "open" : "closed"}>{children}</li>
    </StepperStepContext>
  );
}
