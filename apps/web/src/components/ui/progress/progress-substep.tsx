import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";
import { Badge } from "@stargazer/ui";
import type { ProgressSubstepData } from "@stargazer/schemas/ui";

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

export interface ProgressSubstepProps
  extends ProgressSubstepData,
    Omit<VariantProps<typeof substepVariants>, 'status'> {
  className?: string;
}

export function ProgressSubstep({
  tag,
  label,
  status,
  detail,
  className,
}: ProgressSubstepProps) {
  const badgeVariant =
    status === "completed"
      ? "success"
      : status === "active"
        ? "info"
        : status === "error"
          ? "error"
          : "neutral";

  return (
    <div className={cn(substepVariants({ status }), className)}>
      <Badge variant={badgeVariant} size="sm" className="min-w-[40px] justify-center">
        {tag}
      </Badge>
      <span>{label}</span>
      {detail ? (
        <span className="ml-auto text-xs text-tui-muted">{detail}</span>
      ) : status === "active" ? (
        <span className="ml-auto text-xs text-tui-muted">analyzing...</span>
      ) : status === "completed" ? (
        <span className="ml-auto text-xs text-tui-green">done</span>
      ) : status === "error" ? (
        <span className="ml-auto text-xs text-tui-red">failed</span>
      ) : null}
    </div>
  );
}
