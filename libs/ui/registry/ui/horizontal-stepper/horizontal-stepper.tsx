"use client";

import { type ComponentProps, type ReactNode, useMemo } from "react";
import {
  type HorizontalStepperVariant,
  horizontalStepperRootVariants,
} from "@/lib/horizontal-stepper-variants";
import { cn } from "@/lib/utils";
import { HorizontalStepperContext } from "./horizontal-stepper-context";

/** Props for horizontal stepper. */
export interface HorizontalStepperProps extends Omit<ComponentProps<"ol">, "children"> {
  /**
   * Ordered step ids. Used to compute status (completed/active/pending) for each step relative
   * to value.
   */
  steps: string[];
  /** Id of the active step. */
  value: string;
  /** Visual variant. Drives the indicator glyph, connector treatment, and label typography. */
  variant?: HorizontalStepperVariant;
  /**
   * Forces the compact treatment: connectors drop out, only the active step keeps a visible label,
   * and that label is prefixed with "Step 3/6 ·". When false (default) the stepper switches to the
   * same treatment on its own once its container is narrower than 36rem.
   *
   * Compact has a second tier that stays on the container query either way: below 20rem the glyph
   * run is dropped too and only the "Step 3/6 · Label" text remains.
   */
  compact?: boolean;
  /** HorizontalStepper.Step children, one per id in steps. */
  children: ReactNode;
}

/** Sibling primitive: compact horizontal step bar. */
export function HorizontalStepperRoot({
  steps,
  value,
  variant = "ascii",
  compact = false,
  children,
  className,
  "aria-label": ariaLabel,
  ...props
}: HorizontalStepperProps) {
  const contextValue = useMemo(
    () => ({ value, steps, variant, compact }),
    [value, steps, variant, compact],
  );

  return (
    <HorizontalStepperContext value={contextValue}>
      {/* biome-ignore lint/a11y/useSemanticElements: this already is an <ol>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
      <ol
        {...props}
        // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ol>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
        role="list"
        aria-label={ariaLabel || "Progress"}
        data-slot="horizontal-stepper"
        data-variant={variant}
        className={cn(horizontalStepperRootVariants({ variant }), className)}
      >
        {children}
      </ol>
    </HorizontalStepperContext>
  );
}
