import { cn } from "@/utils/cn";
import { Badge } from "@stargazer/ui";
import type { Run } from "@/features/history/types";

export interface RunAccordionItemProps {
  run: Run;
  isSelected: boolean;
  onSelect: () => void;
  onOpen?: () => void;
  className?: string;
}

export function RunAccordionItem({
  run,
  isSelected,
  onSelect,
  onOpen,
  className,
}: RunAccordionItemProps) {
  const { id, displayId, branch, provider, timestamp, summary } = run;
  return (
    <div
      id={id}
      role="option"
      data-value={id}
      aria-selected={isSelected}
      onDoubleClick={onOpen}
      className={cn(
        "border-b border-tui-border relative group",
        isSelected && "bg-tui-selection",
        !isSelected && "hover:bg-tui-selection",
        className
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-tui-violet" />
      )}

      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className="p-3 pl-4 cursor-pointer overflow-hidden"
      >
        <div className="flex justify-between items-start mb-1 min-w-0">
          <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
            <span className={cn("font-bold text-sm shrink-0", isSelected ? "text-tui-blue" : "text-tui-muted")}>
              {displayId}
            </span>
            <Badge variant="neutral" size="sm" className="shrink-0">{branch}</Badge>
            <span className="text-xs text-tui-muted truncate">{provider}</span>
          </div>
          <span className="text-xs text-tui-muted shrink-0 ml-2">{timestamp}</span>
        </div>
        <div className={cn("text-sm mb-2 line-clamp-2 overflow-hidden", isSelected ? "text-tui-fg" : "text-tui-muted")}>
          {summary}
        </div>
        {/* TODO: Add Resume and Export actions when handlers are implemented */}
      </div>

    </div>
  );
}
