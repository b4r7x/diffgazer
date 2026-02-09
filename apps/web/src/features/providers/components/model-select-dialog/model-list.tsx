import type { ModelInfo } from "@diffgazer/schemas/config";
import { ModelListItem } from "./model-list-item";

interface ModelListProps {
  models: ModelInfo[];
  focusedModelId: string | null;
  currentModelId?: string;
  isFocused: boolean;
  onSelect: (modelId: string) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  emptyLabel?: string;
  ref?: React.Ref<HTMLDivElement>;
}

export function ModelList({
  models,
  focusedModelId,
  currentModelId,
  isFocused,
  onSelect,
  onConfirm,
  isLoading,
  emptyLabel,
  ref,
}: ModelListProps) {
  if (models.length === 0) {
    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Available models"
        className="px-4 py-3 max-h-60 overflow-y-auto scrollbar-thin"
      >
        <div className="text-center text-tui-muted py-8 text-sm">
          {isLoading ? "Loading models..." : emptyLabel ?? "No models match your search"}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Available models"
      className="px-4 py-3 space-y-1 max-h-60 overflow-y-auto scrollbar-thin"
    >
      {models.map((model) => (
        <ModelListItem
          key={model.id}
          model={model}
          isSelected={model.id === focusedModelId}
          isChecked={model.id === currentModelId}
          isFocused={isFocused}
          onClick={() => onSelect(model.id)}
          onDoubleClick={onConfirm}
        />
      ))}
    </div>
  );
}
