"use client";

import { type ReactNode, useMemo } from "react";
import {
  type HorizontalStepperVariant,
  horizontalStepperRootVariants,
} from "@/lib/stepper-variants";
import { cn } from "@/lib/utils";
import { HorizontalStepperContext } from "./horizontal-stepper-context";

export interface HorizontalStepperProps {
  steps: string[];
  value: string;
  variant?: HorizontalStepperVariant;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function HorizontalStepperRoot({
  steps,
  value,
  variant = "ascii",
  children,
  className,
  "aria-label": ariaLabel,
}: HorizontalStepperProps) {
  const contextValue = useMemo(
    () => ({ value, steps, variant }),
    [value, steps, variant],
  );

  return (
    <HorizontalStepperContext value={contextValue}>
      <ol
        aria-label={ariaLabel ?? "Progress"}
        data-variant={variant}
        className={cn(horizontalStepperRootVariants({ variant }), className)}
      >
        {children}
      </ol>
    </HorizontalStepperContext>
  );
}
