import { cn } from "@/lib/utils";
import type { TriageSeverity } from "@stargazer/schemas/triage";
import { SEVERITY_CONFIG } from "@stargazer/schemas/ui";

export interface SeverityFilterButtonProps {
  severity: TriageSeverity;
  count: number;
  isActive: boolean;
  isFocused?: boolean;
  onClick: () => void;
  className?: string;
}

export function SeverityFilterButton({
  severity,
  count,
  isActive,
  isFocused,
  onClick,
  className,
}: SeverityFilterButtonProps) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-1.5 text-xs transition-colors",
        isActive ? config.color : config.color,
        isFocused && "ring-1 ring-tui-blue",
        className
      )}
      style={isActive ? { backgroundColor: "currentColor" } : undefined}
    >
      <span className={isActive ? "text-black" : undefined}>
        [{config.label} {count}]
      </span>
    </button>
  );
}
