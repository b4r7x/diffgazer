"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { stepperStepVariants } from "@/lib/stepper-variants";
import { cn } from "@/lib/utils";
import { StepperContent } from "./stepper-content";
import { StepperStepContext, type StepStatus, useStepperContext } from "./stepper-context";

/** Props for stepper step. */
export interface StepperStepProps extends Omit<ComponentProps<"li">, "children"> {
  /** Stable identifier matched against expandedIds. */
  stepId: string;
  /**
   * Step status. Drives the indicator glyph, label styling, aria-current, aria-disabled, and
   * tab-order eligibility.
   */
  status: StepStatus;
  /** StepperTrigger and optional StepperContent. */
  children: ReactNode;
  /** Ref forwarded to the underlying element. */
  ref?: ComponentProps<"li">["ref"];
}

function hasStepperContent(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === StepperContent,
  );
}

/** Individual step with status context. */
export function StepperStep({
  stepId,
  status,
  children,
  className,
  ref,
  ...props
}: StepperStepProps) {
  const { expandedIds, registerStep, unregisterStep } = useStepperContext();
  const isExpanded = expandedIds.includes(stepId);

  const base = useId();
  const registrationId = useId();
  const rootRef = useRef<HTMLLIElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const triggerId = `${base}-trigger`;
  const contentId = `${base}-content`;
  const hasContent = hasStepperContent(children);
  const [triggerLabel, setTriggerLabel] = useState<string | undefined>(undefined);

  useLayoutEffect(() => {
    registerStep(registrationId, { id: stepId, status, label: triggerLabel }, rootRef.current);
    return () => unregisterStep(registrationId);
  }, [registerStep, unregisterStep, registrationId, stepId, status, triggerLabel]);

  const ctx = useMemo(
    () => ({ stepId, isExpanded, status, triggerId, contentId, hasContent, setTriggerLabel }),
    [stepId, isExpanded, status, triggerId, contentId, hasContent],
  );

  return (
    <StepperStepContext value={ctx}>
      <li
        {...props}
        ref={composedRef}
        className={cn(stepperStepVariants(), className)}
        data-state={isExpanded ? "open" : "closed"}
        data-status={status}
      >
        {children}
      </li>
    </StepperStepContext>
  );
}
