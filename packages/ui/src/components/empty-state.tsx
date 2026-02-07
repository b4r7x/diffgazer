import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { cva } from "class-variance-authority";

export interface EmptyStateProps {
  message: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "centered" | "inline";
  className?: string;
}

export const emptyStateVariants = cva("text-tui-muted", {
  variants: {
    variant: {
      centered: "text-center py-8",
      inline: "text-sm italic",
    },
  },
  defaultVariants: {
    variant: "centered",
  },
});

export function EmptyState({
  message,
  description,
  icon,
  action,
  variant = "centered",
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(emptyStateVariants({ variant }), className)}>
      {icon && <div className="mb-3">{icon}</div>}
      <div>{message}</div>
      {description && <div className="mt-1 text-sm">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
