"use client";

import type { ComponentProps, ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Badge } from "../badge/badge";
import { useStepperContext, useStepperStepContext, type StepStatus } from "./stepper-context";

const stepVariants = cva(
  "flex items-start gap-3 appearance-none bg-transparent border-0 p-0 text-left w-full font-[inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  {
  variants: {
    status: {
      completed: "",
      active: "bg-secondary py-2 -mx-3 px-3 rounded border-l-2 border-foreground",
      pending: "",
      error: "bg-destructive/10 py-2 -mx-3 px-3 rounded border-l-2 border-destructive",
    },
  },
  defaultVariants: {
    status: "pending",
  },
});

const labelVariants = cva("text-sm", {
  variants: {
    status: {
      completed: "text-foreground",
      active: "font-bold text-foreground",
      pending: "text-muted-foreground",
      error: "font-medium text-destructive",
    },
  },
  defaultVariants: {
    status: "pending",
  },
});

export const STEP_STATUS_BADGE_VARIANTS: Record<StepStatus, "success" | "info" | "neutral" | "error"> = {
  completed: "success",
  active: "info",
  pending: "neutral",
  error: "error",
};

export const DEFAULT_STEP_STATUS_LABELS: Record<StepStatus, string> = {
  completed: "Completed",
  active: "Active",
  pending: "Pending",
  error: "Error",
};

export interface StepperTriggerProps
  extends Omit<ComponentProps<"button">, "children" | "type"> {
  children: ReactNode;
  /** Override the per-status badge text. Falls back to `DEFAULT_STEP_STATUS_LABELS`. */
  statusLabels?: Partial<Record<StepStatus, string>>;
}

export function StepperTrigger({ children, className, onClick, statusLabels, ...props }: StepperTriggerProps) {
  const { onToggle } = useStepperContext();
  const { stepId, isExpanded, status, triggerId, contentId, hasContent } = useStepperStepContext();
  const badgeLabel = statusLabels?.[status] ?? DEFAULT_STEP_STATUS_LABELS[status];

  return (
    <button
      type="button"
      {...props}
      className={cn(stepVariants({ status }), className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && hasContent) onToggle(stepId);
      }}
      aria-expanded={hasContent ? isExpanded : undefined}
      aria-controls={hasContent ? contentId : undefined}
      id={triggerId}
      aria-current={status === "active" ? "step" : undefined}
    >
      <span className="shrink-0">
        <Badge variant={STEP_STATUS_BADGE_VARIANTS[status]} size="sm" className="min-w-[48px] justify-center">
          {badgeLabel}
        </Badge>
      </span>
      <span className={labelVariants({ status })}>{children}</span>
    </button>
  );
}
