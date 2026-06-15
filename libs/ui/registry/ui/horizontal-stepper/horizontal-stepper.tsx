"use client";

import { type ReactNode, useMemo } from "react";
import {
  type HorizontalStepperVariant,
  horizontalStepperRootVariants,
} from "@/lib/stepper-variants";
import { cn } from "@/lib/utils";
import { HorizontalStepperContext } from "./horizontal-stepper-context";

/** Props for horizontal stepper. */
export interface HorizontalStepperProps {
  /**
   * Ordered step ids. Used to compute status (completed/active/pending) for each step relative
   * to value.
   */
  steps: string[];
  /** Id of the active step. */
  value: string;
  /** Visual variant. Drives the indicator glyph, connector treatment, and label typography. */
  variant?: HorizontalStepperVariant;
  /** HorizontalStepper.Step children, one per id in steps. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Accessible name for the <ol> list. */
  "aria-label"?: string;
}

/** Sibling primitive: compact horizontal step bar. */
export function HorizontalStepperRoot({
  steps,
  value,
  variant = "ascii",
  children,
  className,
  "aria-label": ariaLabel,
}: HorizontalStepperProps) {
  const contextValue = useMemo(() => ({ value, steps, variant }), [value, steps, variant]);

  return (
    <HorizontalStepperContext value={contextValue}>
      <ol
        aria-label={ariaLabel ?? "Progress"}
        data-slot="horizontal-stepper"
        data-variant={variant}
        className={cn(horizontalStepperRootVariants({ variant }), className)}
      >
        {children}
      </ol>
    </HorizontalStepperContext>
  );
}
