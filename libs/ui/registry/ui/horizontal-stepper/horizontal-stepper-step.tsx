"use client";

import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useStepInfo, type StepStatus } from "./horizontal-stepper-context";

export const stepVariants = cva("px-1.5 py-0.5", {
  variants: {
    status: {
      active: "bg-foreground text-primary-foreground font-bold",
      completed: "text-success",
      pending: "text-muted-foreground",
      error: "text-error-fg font-bold",
    },
  },
  defaultVariants: { status: "pending" },
});

const srLabel: Record<StepStatus, string> = {
  completed: "Completed: ",
  active: "Current: ",
  pending: "Upcoming: ",
  error: "Error: ",
};

export interface HorizontalStepperStepProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function HorizontalStepperStep({ value, children, className }: HorizontalStepperStepProps) {
  const { status, index } = useStepInfo(value);

  return (
    <li aria-current={status === "active" ? "step" : undefined} className="flex items-center gap-1">
      {index > 0 && (
        <span aria-hidden="true" className={cn("mx-0.5", status === "completed" ? "text-success" : "text-border")}>
          -
        </span>
      )}
      <span className={cn(stepVariants({ status }), className)}>
        <span className="sr-only">{srLabel[status]}</span>
        {children}
      </span>
    </li>
  );
}
