import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  message: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "centered" | "inline";
  className?: string;
}

export function EmptyState({ message, description, icon, action, variant = "centered", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-tui-muted",
        variant === "centered" && "text-center py-8",
        variant === "inline" && "text-sm italic",
        className
      )}
    >
      {icon && <div className="mb-3">{icon}</div>}
      <div>{message}</div>
      {description && <div className="mt-1 text-sm">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
