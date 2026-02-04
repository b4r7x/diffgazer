import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ProgressSubstepData } from "@stargazer/schemas/ui";

const substepVariants = cva("flex items-center gap-2 py-1 text-sm", {
  variants: {
    status: {
      pending: "text-gray-600",
      active: "text-tui-blue font-medium animate-pulse",
      completed: "text-tui-fg",
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
  emoji,
  label,
  status,
  className,
}: ProgressSubstepProps) {
  return (
    <div className={cn(substepVariants({ status }), className)}>
      <span className="w-5 text-center">{emoji}</span>
      <span>{label}</span>
      {status === "active" && (
        <span className="ml-auto text-xs text-gray-500">analyzing...</span>
      )}
      {status === "completed" && (
        <span className="ml-auto text-xs text-tui-green">✓</span>
      )}
    </div>
  );
}
