import { useRef } from "react";
import { cn } from "@/utils/cn";
import { useNavigation } from "@stargazer/keyboard";
import type { TimelineItem } from "@stargazer/schemas/ui";

export interface TimelineListProps {
  items: TimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  keyboardEnabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  className?: string;
}

export function TimelineList({
  items,
  selectedId,
  onSelect,
  keyboardEnabled = true,
  onBoundaryReached,
  className,
}: TimelineListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { focusedValue } = useNavigation({
    containerRef,
    role: "option",
    value: selectedId,
    onValueChange: onSelect,
    enabled: keyboardEnabled,
    wrap: false,
    onBoundaryReached,
  });

  const activeId = keyboardEnabled ? (focusedValue ?? selectedId) : null;

  return (
    <div ref={containerRef} role="listbox" className={cn("space-y-1", className)}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        const isSelected = item.id === selectedId;
        const isSelectedOnly = isSelected && !isActive;
        return (
          <div
            key={item.id}
            id={item.id}
            role="option"
            data-value={item.id}
            aria-selected={isSelected}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex items-center justify-between text-sm px-2 py-1 rounded cursor-pointer border-l-2 border-l-transparent",
              isActive && "bg-tui-selection text-tui-blue font-bold",
              isSelectedOnly && "text-tui-fg border-l-tui-blue/60",
              !isActive && "text-tui-muted hover:text-tui-fg hover:bg-tui-selection/30"
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px]",
                  isActive ? "text-tui-blue" : isSelectedOnly ? "text-tui-blue/70" : "text-muted-foreground"
                )}
              >
                {isActive || isSelectedOnly ? "●" : "○"}
              </span>
              {item.label}
            </span>
            <span className={cn("text-xs", isActive ? "opacity-70" : isSelectedOnly ? "opacity-60" : "opacity-50")}>
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
