import { cn } from "@/lib/utils";
import type { TriageSeverity } from "@repo/schemas/triage";
import type { TriageIssue } from "@repo/schemas";
import { SEVERITY_CONFIG } from "@repo/schemas/ui";

export interface IssueListItemProps {
  issue: TriageIssue;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

export function IssueListItem({ issue, isSelected, onClick, className }: IssueListItemProps) {
  const severity = issue.severity as TriageSeverity;
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.medium;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-2 py-1 flex items-center cursor-pointer",
        isSelected && "bg-tui-blue text-black font-bold",
        !isSelected && "hover:bg-tui-selection group",
        className
      )}
    >
      <span
        className={cn("mr-2", isSelected && "text-black", !isSelected && "opacity-0 group-hover:opacity-100")}
        aria-hidden="true"
      >
        |
      </span>
      <span className={cn("mr-2", isSelected ? "text-black" : config.color)} aria-hidden="true">
        {config.icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="truncate">{issue.title}</span>
        <span className={cn("text-[10px]", isSelected ? "opacity-80" : "text-gray-500")}>
          {issue.file}:{issue.line_start}
        </span>
      </div>
    </button>
  );
}
