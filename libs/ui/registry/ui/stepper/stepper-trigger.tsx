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

const STEP_STATUS_CONFIG: Record<StepStatus, {
  badgeLabel: string;
  badgeVariant: "success" | "info" | "neutral" | "error";
}> = {
  completed: { badgeLabel: "DONE", badgeVariant: "success" },
  active:    { badgeLabel: "RUN",  badgeVariant: "info" },
  pending:   { badgeLabel: "WAIT", badgeVariant: "neutral" },
  error:     { badgeLabel: "FAIL", badgeVariant: "error" },
};

export interface StepperTriggerProps
  extends Omit<ComponentProps<"button">, "children" | "type"> {
  children: ReactNode;
}

export function StepperTrigger({ children, className, ...props }: StepperTriggerProps) {
  const { onToggle } = useStepperContext();
  const { stepId, isExpanded, status, triggerId, contentId } = useStepperStepContext();

  return (
    <button
      type="button"
      {...props}
      className={cn(stepVariants({ status }), className)}
      onClick={() => onToggle(stepId)}
      aria-expanded={isExpanded}
      aria-controls={contentId}
      id={triggerId}
      aria-current={status === "active" ? "step" : undefined}
    >
      <span className="shrink-0">
        <Badge variant={STEP_STATUS_CONFIG[status].badgeVariant} size="sm" className="min-w-[48px] justify-center">
          {STEP_STATUS_CONFIG[status].badgeLabel}
        </Badge>
      </span>
      <span className={labelVariants({ status })}>{children}</span>
    </button>
  );
}
