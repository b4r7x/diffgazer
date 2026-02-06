import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModelInfo } from "@stargazer/schemas/config";

interface ModelListItemProps {
  model: ModelInfo;
  isSelected: boolean;
  isChecked: boolean;
  isFocused: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export function ModelListItem({
  model,
  isSelected,
  isChecked,
  isFocused,
  onClick,
  onDoubleClick,
}: ModelListItemProps) {
  return (
    <button
      role="option"
      aria-selected={isSelected}
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "flex items-start gap-3 w-full text-left px-3 py-2 rounded transition-colors",
        isSelected && isFocused
          ? "bg-tui-selection/60 text-tui-fg ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg"
          : "text-gray-400 hover:bg-tui-selection/30 hover:text-tui-fg"
      )}
    >
      <span
        className={cn(
          "font-bold shrink-0 mt-0.5",
          isChecked ? "text-tui-blue" : "text-gray-600"
        )}
      >
        {isChecked ? "[ \u25cf ]" : "[   ]"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold">{model.name}</span>
          <Badge
            variant={model.tier === "free" ? "success" : "neutral"}
            size="sm"
            className="uppercase border border-tui-border px-1.5 py-0.5"
          >
            {model.tier}
          </Badge>
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {model.description}
        </div>
      </div>
    </button>
  );
}
