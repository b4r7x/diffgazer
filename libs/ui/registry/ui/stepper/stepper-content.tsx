"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStepperStepContext } from "./stepper-context";

export interface StepperContentProps extends Omit<ComponentProps<"div">, "children"> {
  children: ReactNode;
}

export function StepperContent({ children, className, ...props }: StepperContentProps) {
  const { isExpanded, triggerId, contentId } = useStepperStepContext();

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="region" labels the collapsible step panel via aria-labelledby; the grid div owns the expand/collapse animation, so a <section> swap is not appropriate.
    <div
      {...props}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
      role="region"
      id={contentId}
      aria-labelledby={triggerId}
      aria-hidden={isExpanded ? undefined : true}
      inert={isExpanded ? undefined : true}
    >
      <div className="overflow-hidden min-h-0">
        <div className="pt-2 pl-7" hidden={!isExpanded}>
          {children}
        </div>
      </div>
    </div>
  );
}
