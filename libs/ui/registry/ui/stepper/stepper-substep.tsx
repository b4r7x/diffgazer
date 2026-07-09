"use client";

import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "../badge/badge";
import type { SubstepStatus } from "./stepper-context";

/** Root provider (manages expansion + variant) */
export interface SubstepData {
  /** ID applied to the rendered element. */
  id: string;
  tag: string;
  /** Accessible label text. */
  label: string;
  /** Current status value. */
  status: SubstepStatus;
  detail?: string;
}

/** Class variants for substep. */
export const substepVariants = cva("flex items-center gap-2 py-1 text-sm", {
  variants: {
    status: {
      pending: "text-muted-foreground",
      active: "text-foreground font-medium motion-safe:animate-pulse",
      completed: "text-foreground",
      error: "text-error font-medium",
    },
  },
  defaultVariants: { status: "pending" },
});

/** Root provider (manages expansion + variant) */
export const SUBSTEP_STATUS_BADGE_VARIANTS: Record<
  SubstepStatus,
  "success" | "info" | "error" | "neutral"
> = {
  pending: "neutral",
  active: "info",
  completed: "success",
  error: "error",
};

/** Class variants for substep label. */
export const substepLabelVariants = cva("", {
  variants: {
    status: {
      pending: "",
      active: "text-muted-foreground",
      completed: "text-success",
      error: "text-error",
    },
  },
  defaultVariants: { status: "pending" },
});

/** Props for stepper substep. */
export interface StepperSubstepProps
  extends Omit<ComponentProps<"div">, "children">,
    Omit<SubstepData, "id"> {
  /** Per-status fallback labels shown when detail is omitted. */
  statusLabels?: Partial<Record<SubstepStatus, string>>;
}

/** Nested substep with tag badge and status. */
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

  return (
    <div {...props} className={cn(substepVariants({ status }), className)}>
      <Badge
        variant={SUBSTEP_STATUS_BADGE_VARIANTS[status]}
        size="sm"
        className="min-w-[40px] justify-center"
      >
        {tag}
      </Badge>
      <span className="shrink-0">{label}</span>
      {statusText && (
        <span
          title={statusText}
          className={cn(
            "ml-auto min-w-0 truncate text-xs",
            detail ? "text-muted-foreground" : substepLabelVariants({ status }),
          )}
        >
          {statusText}
        </span>
      )}
    </div>
  );
}
