"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  horizontalStepperRootVariants,
  type HorizontalStepperVariant,
} from "@/lib/stepper-variants";
import { HorizontalStepperContext } from "./horizontal-stepper-context";

export interface HorizontalStepperProps {
  steps: string[];
  value: string;
  /**
   * Visual variant:
   *   - `ascii` — `[x] Init ─── [~] Build ─── [ ] Deploy`, solid 1px connectors.
   *   - `numbered` — numbered square above a continuous 1px line; label below
   *     uppercase. Material-adapted, with no width shift on active.
   *   - `breadcrumb` — `init / build › deploy / verify`, slash separators,
   *     caret on the active step.
   */
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
