import { cn } from "../lib/cn";

export interface KeyValueProps {
  label: React.ReactNode;
  value: React.ReactNode;
  variant?: "default" | "warning" | "info" | "success" | "error";
  layout?: "horizontal" | "vertical";
  className?: string;
}

const valueVariants = {
  default: "font-bold text-tui-fg",
  warning: "font-bold text-tui-yellow",
  info: "font-mono text-tui-blue",
  success: "font-bold text-tui-green",
  error: "font-bold text-tui-red",
};

export function KeyValue({
  label,
  value,
  variant = "default",
  layout = "horizontal",
  className,
}: KeyValueProps) {
  return (
    <div
      className={cn(
        layout === "horizontal"
          ? "flex justify-between items-center"
          : "flex flex-col gap-1",
        className
      )}
    >
      <span className="text-sm text-tui-muted">{label}</span>
      <span className={valueVariants[variant]}>{value}</span>
    </div>
  );
}
