import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { Badge } from "@diffgazer/ui/components/badge";
import { RadioGroupItem } from "@diffgazer/ui/components/radio";
import { SELECTED_OPTION_ROW } from "@/lib/selected-option-row";

interface ModelListItemProps {
  model: ModelInfo;
  onDoubleClick: () => void;
}

export function ModelListItem({ model, onDoubleClick }: ModelListItemProps) {
  return (
    <RadioGroupItem
      value={model.id}
      onDoubleClick={onDoubleClick}
      className={`w-full ${SELECTED_OPTION_ROW}`}
      label={
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 font-mono text-sm font-bold">{model.id}</span>
          {model.name !== model.id ? (
            <span className="min-w-0 text-xs text-muted-foreground">{model.name}</span>
          ) : null}
          <Badge variant={model.tier === "free" ? "success" : "neutral"} size="xs">
            {model.tier}
          </Badge>
        </span>
      }
      description={model.description || undefined}
    />
  );
}
