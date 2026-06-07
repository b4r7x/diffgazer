import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { getVerticalArrowDirection } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { RadioGroup } from "@diffgazer/ui/components/radio";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { ModelListItem } from "./list-item";

interface ModelListProps {
  models: ModelInfo[];
  focusedModelId: string | null;
  currentModelId?: string;
  isFocused: boolean;
  onSelect: (modelId: string) => void;
  onConfirm: (modelId?: string) => void;
  onHighlightChange: (modelId: string | null) => void;
  onBoundaryReached: (direction: "previous" | "next") => void;
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
  onHighlightChange,
  onBoundaryReached,
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
        className="px-4 py-3 max-h-[50vh] overflow-y-auto scrollbar-thin"
      >
        <EmptyState size="sm" live>
          {isLoading ? (
            <>
              <Spinner size="sm" aria-hidden="true" />
              <EmptyState.Message>Loading models...</EmptyState.Message>
            </>
          ) : (
            <EmptyState.Message>{emptyLabel ?? "No models match your search"}</EmptyState.Message>
          )}
        </EmptyState>
      </div>
    );
  }

  return (
    <RadioGroup
      ref={ref}
      aria-label="Available models"
      value={currentModelId}
      highlighted={isFocused ? focusedModelId : null}
      onChange={onSelect}
      onHighlightChange={onHighlightChange}
      onEnter={onConfirm}
      onNavigationBoundaryReached={(direction, event) => {
        if (getVerticalArrowDirection(event.key) !== null) onBoundaryReached(direction);
      }}
      activationMode="manual"
      autoFocus={isFocused}
      wrap={false}
      className="min-h-0 px-4 py-3 space-y-1 max-h-[50vh] overflow-y-auto scrollbar-thin"
    >
      {models.map((model) => (
        <ModelListItem key={model.id} model={model} onDoubleClick={() => onConfirm(model.id)} />
      ))}
    </RadioGroup>
  );
}
