import { cn } from "@/utils/cn";
import type { ReviewIssue } from "@stargazer/schemas/review";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";

export interface IssueListItemProps {
  issue: ReviewIssue;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

export function IssueListItem({ issue, isSelected, onClick, className }: IssueListItemProps) {
  const config = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.medium;

  return (
    <button
      type="button"
      role="option"
      data-value={issue.id}
      aria-selected={isSelected}
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
        <span className={cn("text-[10px]", isSelected ? "opacity-80" : "text-tui-muted")}>
          {issue.file}:{issue.line_start}
        </span>
      </div>
    </button>
  );
}
