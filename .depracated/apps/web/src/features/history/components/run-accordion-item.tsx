import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, IssueListItem } from "@/components/ui";
import type { TriageIssue } from "@repo/schemas";

export interface RunAccordionItemProps {
  id: string;
  displayId: string;
  branch: string;
  provider: string;
  timestamp: string;
  summary: ReactNode;
  issues: TriageIssue[];
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onOpen?: () => void;
  onIssueClick?: (issueId: string) => void;
  className?: string;
}

export function RunAccordionItem({
  id,
  displayId,
  branch,
  provider,
  timestamp,
  summary,
  issues,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onOpen,
  onIssueClick,
  className,
}: RunAccordionItemProps) {
  return (
    <div
      id={id}
      role="option"
      data-value={id}
      aria-selected={isSelected}
      aria-expanded={isExpanded}
      onDoubleClick={onOpen}
      className={cn(
        "border-b border-tui-border relative group",
        isSelected && "bg-tui-selection",
        !isSelected && "hover:bg-white/5",
        className
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-tui-violet" />
      )}

      {/* Header */}
      <div
        onClick={onSelect}
        className="p-3 pl-4 cursor-pointer overflow-hidden"
      >
        <div className="flex justify-between items-start mb-1 min-w-0">
          <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
            <span className={cn("font-bold text-sm shrink-0", isSelected ? "text-tui-blue" : "text-gray-400")}>
              {displayId}
            </span>
            <Badge variant="neutral" size="sm" className="shrink-0">{branch}</Badge>
            <span className="text-xs text-gray-500 truncate">{provider}</span>
          </div>
          <span className="text-xs text-gray-500 shrink-0 ml-2">{timestamp}</span>
        </div>
        <div className={cn("text-sm mb-2 line-clamp-2 overflow-hidden", isSelected ? "text-tui-fg" : "text-gray-400")}>
          {summary}
        </div>
        <div className={cn(
          "flex gap-4 text-xs font-mono text-gray-500",
          !isSelected && "opacity-0 group-hover:opacity-100 transition-opacity"
        )}>
          <span className="hover:text-tui-violet cursor-pointer">
            <span className="text-tui-violet">[r]</span> Resume
          </span>
          <span className="hover:text-tui-blue cursor-pointer">
            <span className="text-tui-blue">[e]</span> Export
          </span>
        </div>
      </div>

      {/* Expanded issue list */}
      {isExpanded && issues.length > 0 && (
        <div className="border-t border-tui-border bg-black/30 pb-2 overflow-hidden">
          {issues.map((issue) => (
            <IssueListItem
              key={issue.id}
              issue={issue}
              isSelected={false}
              onClick={() => onIssueClick?.(issue.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
