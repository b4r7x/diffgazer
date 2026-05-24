"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  HORIZONTAL_STEP_INDICATOR_GLYPHS,
  horizontalStepperBreadcrumbSeparatorClass,
  horizontalStepperConnectorClass,
  horizontalStepperGlyphVariants,
  horizontalStepperLabelVariants,
  horizontalStepperStepVariants,
} from "@/lib/stepper-variants";
import { useStepInfo, useStepperContext, type HorizontalStepStatus } from "./horizontal-stepper-context";

const SR_LABEL: Record<HorizontalStepStatus, string> = {
  completed: "Completed: ",
  active: "Current: ",
  pending: "Upcoming: ",
};

export interface HorizontalStepperStepProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function HorizontalStepperStep({ value, children, className }: HorizontalStepperStepProps) {
  const { variant } = useStepperContext();
  const { status, index } = useStepInfo(value);
  const showConnectorBefore = index > 0;

  const glyph = renderGlyph(variant, status);

  // For the `numbered` variant the connector lives in the step's pseudo-
  // element; we expose the completion state via `data-conn-completed` so the
  // CSS reads "completed connector = green line". Only `completed` steps fill
  // their incoming segment — the active step's incoming connector stays
  // border-coloured to read as still-in-progress, mirroring the vertical
  // stepper spec where only segments leading INTO a completed indicator turn
  // green.
  const isConnCompleted = status === "completed";

  return (
    <>
      {showConnectorBefore && variant === "ascii" && (
        <li role="presentation" aria-hidden="true" className="inline-flex items-center">
          <span
            data-completed={status === "completed" ? "true" : undefined}
            className={horizontalStepperConnectorClass}
          >
            ───
          </span>
        </li>
      )}
      {showConnectorBefore && variant === "breadcrumb" && (
        <li role="presentation" aria-hidden="true" className="inline-flex items-center">
          <span className={horizontalStepperBreadcrumbSeparatorClass}>/</span>
        </li>
      )}
      <li
        aria-current={status === "active" ? "step" : undefined}
        data-status={status}
        data-conn-completed={isConnCompleted ? "true" : undefined}
        className={cn(horizontalStepperStepVariants({ variant }), className)}
      >
        {glyph !== null && (
          <span className={cn(horizontalStepperGlyphVariants({ variant, status }))}>
            <span className="sr-only">{SR_LABEL[status]}</span>
            {glyph}
          </span>
        )}
        <span className={cn(horizontalStepperLabelVariants({ variant, status }))}>
          {glyph === null && <span className="sr-only">{SR_LABEL[status]}</span>}
          {children}
        </span>
      </li>
    </>
  );
}

function renderGlyph(
  variant: "ascii" | "numbered" | "breadcrumb",
  status: HorizontalStepStatus,
): ReactNode {
  if (variant === "numbered") {
    if (status === "completed") return "✓";
    return <span data-counter aria-hidden="true" />;
  }
  if (variant === "breadcrumb" && status === "pending") return null;
  const glyph = HORIZONTAL_STEP_INDICATOR_GLYPHS[variant][status];
  return glyph || null;
}
