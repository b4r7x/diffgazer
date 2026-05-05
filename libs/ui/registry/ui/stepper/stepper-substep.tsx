"use client";

import type { ComponentProps } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Badge } from "../badge/badge";
import type { SubstepStatus } from "./stepper-context";

export interface SubstepData {
  id: string;
  tag: string;
  label: string;
  status: SubstepStatus;
  detail?: string;
}

const substepVariants = cva("flex items-center gap-2 py-1 text-sm", {
  variants: {
    status: {
      pending: "text-muted-foreground",
      active: "text-foreground font-medium animate-pulse",
      completed: "text-foreground",
      error: "text-destructive font-medium",
    },
  },
  defaultVariants: { status: "pending" },
});

export interface StepperSubstepProps
  extends Omit<ComponentProps<"div">, "children">,
    Omit<SubstepData, "id"> {}

const SUBSTEP_STATUS_CONFIG: Record<SubstepStatus, {
  badgeVariant: "success" | "info" | "error" | "neutral";
  defaultLabel?: string;
  labelColor?: string;
}> = {
  pending:   { badgeVariant: "neutral" },
  active:    { badgeVariant: "info",    defaultLabel: "analyzing...", labelColor: "text-muted-foreground" },
  completed: { badgeVariant: "success", defaultLabel: "done",        labelColor: "text-success" },
  error:     { badgeVariant: "error",   defaultLabel: "failed",      labelColor: "text-destructive" },
};

export function StepperSubstep({
  tag,
  label,
  status,
  detail,
  className,
  ...props
}: StepperSubstepProps) {
  const config = SUBSTEP_STATUS_CONFIG[status];
  const statusText = detail ?? config.defaultLabel;

  return (
    <div {...props} className={cn(substepVariants({ status }), className)}>
      <Badge variant={config.badgeVariant} size="sm" className="min-w-[40px] justify-center">
        {tag}
      </Badge>
      <span>{label}</span>
      {statusText && (
        <span className={cn("ml-auto text-xs", detail ? "text-muted-foreground" : config.labelColor)}>
          {statusText}
        </span>
      )}
    </div>
  );
}
