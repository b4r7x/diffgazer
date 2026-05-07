"use client";

import { Children, isValidElement, type ComponentProps, type ReactNode, useId, useMemo } from "react";
import { useStepperContext, StepperStepContext, type StepStatus } from "./stepper-context";
import { StepperContent } from "./stepper-content";

export interface StepperStepProps
  extends Omit<ComponentProps<"li">, "children"> {
  stepId: string;
  status: StepStatus;
  children: ReactNode;
}

function hasStepperContent(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => (
    isValidElement(child) && child.type === StepperContent
  ));
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
  const hasContent = hasStepperContent(children);

  const ctx = useMemo(
    () => ({ stepId, isExpanded, status, triggerId, contentId, hasContent }),
    [stepId, isExpanded, status, triggerId, contentId, hasContent],
  );

  return (
    <StepperStepContext value={ctx}>
      <li {...props} className={className} data-state={isExpanded ? "open" : "closed"}>{children}</li>
    </StepperStepContext>
  );
}
