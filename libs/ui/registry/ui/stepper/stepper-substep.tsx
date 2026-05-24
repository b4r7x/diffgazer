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
      active: "text-foreground font-medium motion-safe:animate-pulse",
      completed: "text-foreground",
      error: "text-destructive font-medium",
    },
  },
  defaultVariants: { status: "pending" },
});

export const SUBSTEP_STATUS_BADGE_VARIANTS: Record<SubstepStatus, "success" | "info" | "error" | "neutral"> = {
  pending: "neutral",
  active: "info",
  completed: "success",
  error: "error",
};

const SUBSTEP_STATUS_LABEL_COLORS: Record<SubstepStatus, string | undefined> = {
  pending: undefined,
  active: "text-muted-foreground",
  completed: "text-success",
  error: "text-destructive",
};

export interface StepperSubstepProps
  extends Omit<ComponentProps<"div">, "children">,
    Omit<SubstepData, "id"> {
  statusLabels?: Partial<Record<SubstepStatus, string>>;
}

export function StepperSubstep({
  tag,
  label,
  status,
  detail,
  statusLabels,
  className,
  ...props
}: StepperSubstepProps) {
  const statusText = detail ?? statusLabels?.[status];
  const labelColor = SUBSTEP_STATUS_LABEL_COLORS[status];

  return (
    <div {...props} className={cn(substepVariants({ status }), className)}>
      <Badge variant={SUBSTEP_STATUS_BADGE_VARIANTS[status]} size="sm" className="min-w-[40px] justify-center">
        {tag}
      </Badge>
      <span>{label}</span>
      {statusText && (
        <span className={cn("ml-auto text-xs", detail ? "text-muted-foreground" : labelColor)}>
          {statusText}
        </span>
      )}
    </div>
  );
}
