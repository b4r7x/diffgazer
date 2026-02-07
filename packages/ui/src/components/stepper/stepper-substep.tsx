import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { Badge } from "../badge";

export type SubstepStatus = "pending" | "active" | "completed" | "error";

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
      pending: "text-tui-muted",
      active: "text-tui-blue font-medium animate-pulse",
      completed: "text-tui-fg",
      error: "text-tui-red font-medium",
    },
  },
  defaultVariants: { status: "pending" },
});

export interface StepperSubstepProps
  extends SubstepData,
    Omit<VariantProps<typeof substepVariants>, "status"> {
  className?: string;
  statusLabels?: Partial<Record<SubstepStatus, string>>;
}

const DEFAULT_STATUS_LABELS: Partial<Record<SubstepStatus, string>> = {
  active: "analyzing...",
  completed: "done",
  error: "failed",
};

const statusLabelColors: Record<string, string> = {
  active: "text-tui-muted",
  completed: "text-tui-green",
  error: "text-tui-red",
};

export function StepperSubstep({
  tag,
  label,
  status,
  detail,
  className,
  statusLabels,
}: StepperSubstepProps) {
  const badgeVariant =
    status === "completed"
      ? "success"
      : status === "active"
        ? "info"
        : status === "error"
          ? "error"
          : "neutral";

  const labels = { ...DEFAULT_STATUS_LABELS, ...statusLabels };
  const statusText = detail ?? labels[status];

  return (
    <div className={cn(substepVariants({ status }), className)}>
      <Badge variant={badgeVariant} size="sm" className="min-w-[40px] justify-center">
        {tag}
      </Badge>
      <span>{label}</span>
      {statusText && (
        <span className={cn("ml-auto text-xs", detail ? "text-tui-muted" : statusLabelColors[status])}>
          {statusText}
        </span>
      )}
    </div>
  );
}
