"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HorizontalStepperContext } from "./horizontal-stepper-context";

export interface HorizontalStepperProps {
  steps: string[];
  step: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function HorizontalStepperRoot({
  steps,
  step,
  children,
  className,
  "aria-label": ariaLabel,
}: HorizontalStepperProps) {
  const contextValue = useMemo(() => ({ step, steps }), [step, steps]);

  return (
    <HorizontalStepperContext value={contextValue}>
      <ol
        aria-label={ariaLabel ?? "Progress"}
        className={cn("flex items-center gap-1 font-mono text-[10px]", className)}
      >
        {children}
      </ol>
    </HorizontalStepperContext>
  );
}
