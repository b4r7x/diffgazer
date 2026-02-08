import { cn } from "../lib/cn";

export interface ChecklistItem {
  id: string | number;
  label: React.ReactNode;
}

export interface ChecklistProps {
  items: ChecklistItem[];
  checked: Set<string | number>;
  onToggle: (id: string | number) => void;
  className?: string;
}

export function Checklist({ items, checked, onToggle, className }: ChecklistProps) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {items.map((item) => {
        const isComplete = checked.has(item.id);
        return (
          <button
            type="button"
            key={item.id}
            className="flex gap-2 cursor-pointer w-full text-left"
            onClick={() => onToggle(item.id)}
            aria-pressed={isComplete}
          >
            <span className={isComplete ? "text-tui-green" : "text-tui-fg"} aria-hidden="true">
              [{isComplete ? "x" : " "}]
            </span>
            <span className={isComplete ? "text-tui-muted line-through" : ""}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
