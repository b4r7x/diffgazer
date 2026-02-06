import { cn } from "@/utils/cn";

export interface EmptyStateProps {
  message: string;
  variant?: "centered" | "inline";
  className?: string;
}

export function EmptyState({ message, variant = "centered", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-gray-500",
        variant === "centered" && "text-center py-8",
        variant === "inline" && "text-sm italic",
        className
      )}
    >
      {message}
    </div>
  );
}
