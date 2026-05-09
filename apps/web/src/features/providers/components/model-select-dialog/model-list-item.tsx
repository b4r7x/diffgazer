import { Badge } from "@diffgazer/ui/components/badge";
import { cn } from "@diffgazer/core/cn";
import { Radio } from "@diffgazer/ui/components/radio";
import type { ModelInfo } from "@diffgazer/core/schemas/config";

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
    <Radio
      data-value={model.id}
      checked={isChecked}
      highlighted={isSelected && isFocused}
      onChange={onClick}
      onDoubleClick={onDoubleClick}
      size="sm"
      variant="bullet"
      className={cn(
        "w-full rounded transition-colors",
        isSelected && isFocused && "ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg",
      )}
      label={
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-bold">{model.name}</span>
          <Badge
            variant={model.tier === "free" ? "success" : "neutral"}
            size="sm"
            className="uppercase border border-tui-border px-1.5 py-0.5"
          >
            {model.tier}
          </Badge>
        </span>
      }
      description={model.description}
    />
  );
}
