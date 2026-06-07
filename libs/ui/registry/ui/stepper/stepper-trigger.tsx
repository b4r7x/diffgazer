"use client";

import type { ComponentProps, ReactNode } from "react";
import { STEP_STATUSES, type StepStatus } from "@/lib/step-status";
import {
  NUMBERED_COMPLETED_GLYPH,
  NUMBERED_DISABLED_GLYPH,
  NUMBERED_ERROR_GLYPH,
  NUMBERED_SKIPPED_GLYPH,
  STEP_INDICATOR_GLYPHS,
  type StepperVariant,
  stepperIndicatorVariants,
  stepperLabelVariants,
  stepperTriggerVariants,
} from "@/lib/stepper-variants";
import { cn } from "@/lib/utils";
import { useStepperContext, useStepperStepContext } from "./stepper-context";

export const DEFAULT_STEP_STATUS_LABELS: Record<StepStatus, string> = {
  completed: "DONE",
  active: "RUN",
  pending: "WAIT",
  error: "FAIL",
  skipped: "SKIP",
  disabled: "OFF",
};

const STATUS_SR_PREFIX: Record<StepStatus, string> = {
  completed: "Completed:",
  active: "Current:",
  pending: "Upcoming:",
  error: "Error:",
  skipped: "Skipped:",
  disabled: "Disabled:",
};

export interface StepperTriggerProps extends Omit<ComponentProps<"button">, "children" | "type"> {
  children: ReactNode;
  statusLabels?: Partial<Record<StepStatus, string>>;
}

export function StepperTrigger({
  children,
  className,
  onClick,
  statusLabels,
  disabled: disabledProp,
  ...props
}: StepperTriggerProps) {
  const { onToggle, variant, tabTargetId } = useStepperContext();
  const { stepId, isExpanded, status, triggerId, contentId, hasContent } = useStepperStepContext();

  const isDisabled = disabledProp || status === "disabled";
  const isInteractive = status !== "disabled";
  const tabIndex = tabTargetId === stepId && isInteractive ? 0 : -1;

  const tagLabel = statusLabels?.[status] ?? DEFAULT_STEP_STATUS_LABELS[status];

  return (
    <button
      type="button"
      {...props}
      id={triggerId}
      data-step-id={stepId}
      data-status={status}
      className={cn(stepperTriggerVariants(), className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (status === "disabled") return;
        if (hasContent) onToggle(stepId);
      }}
      aria-expanded={hasContent ? isExpanded : undefined}
      aria-controls={hasContent ? contentId : undefined}
      aria-current={status === "active" ? "step" : undefined}
      aria-disabled={status === "disabled" ? true : undefined}
      disabled={isDisabled && status !== "disabled" ? true : undefined}
      tabIndex={tabIndex}
    >
      <span className={stepperIndicatorVariants({ variant, status })}>
        <span className="sr-only">{STATUS_SR_PREFIX[status]} </span>
        <Glyph variant={variant} status={status} tagLabel={tagLabel} />
      </span>
      <span className={stepperLabelVariants({ status })}>{children}</span>
    </button>
  );
}

interface GlyphProps {
  variant: StepperVariant;
  status: StepStatus;
  tagLabel: string;
}

function Glyph({ variant, status, tagLabel }: GlyphProps) {
  if (variant === "numbered") {
    if (status === "completed") return <>{NUMBERED_COMPLETED_GLYPH}</>;
    if (status === "error") return <>{NUMBERED_ERROR_GLYPH}</>;
    if (status === "skipped") return <>{NUMBERED_SKIPPED_GLYPH}</>;
    if (status === "disabled") return <>{NUMBERED_DISABLED_GLYPH}</>;
    // pending + active render the CSS counter via ::before in the indicator
    // CSS. We attach `data-counter` so the rule selector is variant-scoped.
    return <span data-counter aria-hidden="true" className="contents" />;
  }

  if (variant === "ascii" && status === "active") {
    return (
      <>
        [
        <span
          aria-hidden="true"
          className="motion-safe:animate-[stepper-blink_1s_steps(2)_infinite]"
        >
          ~
        </span>
        ]
      </>
    );
  }

  if (variant === "tag") {
    return <>{tagLabel}</>;
  }

  return <>{STEP_INDICATOR_GLYPHS[variant][status]}</>;
}

export function getStepperIndicatorGlyph(variant: StepperVariant, status: StepStatus): string {
  if (variant === "numbered") {
    switch (status) {
      case "completed":
        return NUMBERED_COMPLETED_GLYPH;
      case "error":
        return NUMBERED_ERROR_GLYPH;
      case "skipped":
        return NUMBERED_SKIPPED_GLYPH;
      case "disabled":
        return NUMBERED_DISABLED_GLYPH;
      default:
        return ""; // CSS counter
    }
  }
  if (variant === "ascii" && status === "active") return "[~]";
  if (variant === "tag") return DEFAULT_STEP_STATUS_LABELS[status];
  return STEP_INDICATOR_GLYPHS[variant][status];
}

export { STEP_STATUSES };
