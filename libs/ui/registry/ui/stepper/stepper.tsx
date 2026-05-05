"use client";

import { useMemo, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StepperContext } from "./stepper-context";
import { useStepperState } from "./use-stepper-state";

export interface StepperProps
  extends Omit<ComponentProps<"ol">, "children"> {
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  children: ReactNode;
}

export function Stepper({
  expandedIds,
  defaultExpandedIds,
  onExpandedChange,
  className,
  children,
  ...props
}: StepperProps) {
  const { expandedIds: expanded, toggle } = useStepperState({
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
  });

  const ctx = useMemo(() => ({ expandedIds: expanded, onToggle: toggle }), [expanded, toggle]);

  return (
    <StepperContext value={ctx}>
      <ol role="list" aria-label="Progress steps" {...props} className={cn("space-y-4 list-none m-0 p-0", className)}>
        {children}
      </ol>
    </StepperContext>
  );
}
