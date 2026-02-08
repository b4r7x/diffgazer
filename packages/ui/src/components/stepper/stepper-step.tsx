import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { StepperSubstep, type SubstepData } from "./stepper-substep";

export type StepStatus = "completed" | "active" | "pending";

const stepVariants = cva("flex items-start gap-3", {
  variants: {
    status: {
      completed: "",
      active: "bg-tui-selection py-2 -mx-3 px-3 rounded border-l-2 border-tui-blue",
      pending: "",
    },
  },
  defaultVariants: {
    status: "pending",
  },
});

const labelVariants = cva("text-sm", {
  variants: {
    status: {
      completed: "text-tui-fg",
      active: "font-bold text-tui-blue",
      pending: "text-tui-muted",
    },
  },
  defaultVariants: {
    status: "pending",
  },
});

const DEFAULT_BADGE_LABELS: Record<StepStatus, string> = {
  completed: "DONE",
  active: "RUN",
  pending: "WAIT",
};

const BADGE_VARIANTS: Record<StepStatus, "success" | "info" | "neutral"> = {
  completed: "success",
  active: "info",
  pending: "neutral",
};

export interface StepperStepProps extends VariantProps<typeof stepVariants> {
  label: string;
  status: StepStatus;
  substeps?: SubstepData[];
  children?: React.ReactNode;
  isExpanded?: boolean;
  stepId?: string;
  onToggle?: (id: string) => void;
  badgeLabels?: Partial<Record<StepStatus, string>>;
  className?: string;
}

export function StepperStep({
  label,
  status,
  substeps,
  children,
  isExpanded = false,
  stepId,
  onToggle,
  badgeLabels,
  className,
}: StepperStepProps) {
  const hasContent = Boolean(children || (substeps && substeps.length > 0));
  const labels = { ...DEFAULT_BADGE_LABELS, ...badgeLabels };

  const handleClick = () => {
    if (hasContent && onToggle && stepId) {
      onToggle(stepId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={className}>
      <div
        className={cn(
          stepVariants({ status }),
          hasContent && "cursor-pointer"
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={hasContent ? 0 : undefined}
        role={hasContent ? "button" : undefined}
        aria-expanded={hasContent ? isExpanded : undefined}
      >
        <span className="shrink-0">
          <Badge variant={BADGE_VARIANTS[status]} size="sm" className="min-w-[48px] justify-center">
            {labels[status]}
          </Badge>
        </span>
        <span className={labelVariants({ status })}>{label}</span>
      </div>
      {hasContent && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="pt-2 pl-7">
              {substeps && substeps.length > 0 && (
                <div className="space-y-1 mb-2">
                  {substeps.map((substep) => (
                    <StepperSubstep key={substep.id} {...substep} />
                  ))}
                </div>
              )}
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
