import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useGroupNavigation } from "@/hooks/keyboard";

export interface TimelineItem {
  id: string;
  label: string;
  count: number;
}

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

  useGroupNavigation({
    containerRef,
    role: "option",
    value: selectedId,
    onValueChange: onSelect,
    enabled: keyboardEnabled,
    wrap: false,
    onBoundaryReached,
  });

  return (
    <div ref={containerRef} role="listbox" className={cn("space-y-1", className)}>
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        return (
          <div
            key={item.id}
            id={item.id}
            role="option"
            data-value={item.id}
            aria-selected={isSelected}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex items-center justify-between text-sm px-2 py-1 rounded cursor-pointer",
              isSelected && "bg-tui-selection text-tui-blue font-bold",
              !isSelected && "text-gray-400 hover:text-tui-fg hover:bg-white/5"
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("text-[10px]", isSelected ? "text-tui-blue" : "text-gray-600")}>
                {isSelected ? "●" : "○"}
              </span>
              {item.label}
            </span>
            <span className={cn("text-xs", isSelected ? "opacity-70" : "opacity-50")}>
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
