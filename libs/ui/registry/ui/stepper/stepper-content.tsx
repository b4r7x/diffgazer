"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStepperStepContext } from "./stepper-context";

/** Props for stepper content. */
export interface StepperContentProps extends Omit<ComponentProps<"div">, "children"> {
  /**
   * Expandable content (e.g. nested StepperSubstep rows). aria-hidden and inert when collapsed.
   */
  children: ReactNode;
  /**
   * Opt in to role="region" with aria-labelledby pointing at the trigger while the step is
   * expanded. Off by default, matching AccordionContent and the APG disclosure pattern: a
   * Stepper can hold any number of simultaneously expanded steps, and one landmark per step is
   * rotor noise. Enable it for a small number of substantive panels.
   */
  region?: boolean;
}

/** Expandable content panel (substeps, custom content) */
export function StepperContent({
  children,
  className,
  region = false,
  ...props
}: StepperContentProps) {
  const { isExpanded, triggerId, contentId } = useStepperStepContext();
  const exposesRegion = region && isExpanded;

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "region" (Biome cannot resolve the ternary); aria-labelledby is applied only in the same branch and is valid for the region role.
    <div
      {...props}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
      role={exposesRegion ? "region" : undefined}
      id={contentId}
      aria-labelledby={exposesRegion ? triggerId : undefined}
      aria-hidden={isExpanded ? undefined : true}
      inert={isExpanded ? undefined : true}
    >
      {/* The collapsed panel is clipped by the 0fr grid track, not `hidden`: a display:none
          child contributes no height, so the collapse would snap instead of animating. */}
      <div className="overflow-hidden min-h-0">
        <div className="pt-2 pl-7">{children}</div>
      </div>
    </div>
  );
}
