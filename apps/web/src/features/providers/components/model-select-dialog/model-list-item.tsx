import { Badge } from "@stargazer/ui";
import { cn } from "@/utils/cn";
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
      role="radio"
      aria-checked={isChecked}
      data-value={model.id}
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "flex items-start gap-3 w-full text-left px-3 py-2 rounded transition-colors",
        isSelected && isFocused
          ? "bg-tui-selection/60 text-tui-fg ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg"
          : "text-tui-muted hover:bg-tui-selection/30 hover:text-tui-fg"
      )}
    >
      <span
        className={cn(
          "font-bold shrink-0 mt-0.5",
          isChecked ? "text-tui-blue" : "text-muted-foreground"
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
        <div className="text-xs text-tui-muted mt-0.5 truncate">
          {model.description}
        </div>
      </div>
    </button>
  );
}
