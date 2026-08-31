import { getModelTierBadge } from "@diffgazer/core/providers";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { Badge } from "@diffgazer/ui/components/badge";
import { RadioGroupItem } from "@diffgazer/ui/components/radio";
import { SELECTED_OPTION_ROW } from "@/lib/selected-option-row";

interface ModelListItemProps {
  model: ModelInfo;
  onDoubleClick: () => void;
}

export function ModelListItem({ model, onDoubleClick }: ModelListItemProps) {
  // The catalog display name leads because it is what a person recognises; the
  // exact id stays beside it because that is the string the review pins.
  const tierBadge = getModelTierBadge(model.tier);

  return (
    <RadioGroupItem
      value={model.id}
      onDoubleClick={onDoubleClick}
      className={`w-full ${SELECTED_OPTION_ROW}`}
      label={
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-sm font-bold">{model.name}</span>
          {model.id !== model.name ? (
            <span className="min-w-0 font-mono text-xs text-muted-foreground">{model.id}</span>
          ) : null}
          {tierBadge ? (
            <Badge variant={tierBadge.variant} size="xs">
              {tierBadge.label}
            </Badge>
          ) : null}
        </span>
      }
      description={model.description || undefined}
    />
  );
}
