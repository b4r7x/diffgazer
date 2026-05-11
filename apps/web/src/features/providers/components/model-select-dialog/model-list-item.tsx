import { Badge } from "@diffgazer/ui/components/badge";
import { RadioGroupItem } from "@diffgazer/ui/components/radio";
import type { ModelInfo } from "@diffgazer/core/schemas/config";

interface ModelListItemProps {
  model: ModelInfo;
  onDoubleClick: () => void;
}

export function ModelListItem({
  model,
  onDoubleClick,
}: ModelListItemProps) {
  return (
    <RadioGroupItem
      value={model.id}
      onDoubleClick={onDoubleClick}
      className="w-full"
      label={
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 font-bold">{model.name}</span>
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
