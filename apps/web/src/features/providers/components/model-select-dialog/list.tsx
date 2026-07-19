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
  isSaving?: boolean;
  emptyLabel?: string;
  ref?: React.Ref<HTMLDivElement>;
}

function StatusMessage({
  isSaving,
  isLoading,
  emptyLabel,
}: {
  isSaving: boolean;
  isLoading: boolean;
  emptyLabel?: string;
}) {
  if (isSaving) {
    return (
      <>
        <Spinner size="sm" aria-hidden="true" />
        <EmptyState.Message>Saving...</EmptyState.Message>
      </>
    );
  }
  if (isLoading) {
    return (
      <>
        <Spinner size="sm" aria-hidden="true" />
        <EmptyState.Message>Loading models...</EmptyState.Message>
      </>
    );
  }
  return <EmptyState.Message>{emptyLabel ?? "No models match your search"}</EmptyState.Message>;
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
  isLoading = false,
  isSaving = false,
  emptyLabel,
  ref,
}: ModelListProps) {
  const showList = !isSaving && models.length > 0;

  return (
    <div ref={ref} className="max-h-[50dvh] overflow-y-auto px-4 py-3 scrollbar-thin">
      {showList ? (
        <RadioGroup
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
          className="min-h-0 space-y-1"
        >
          {models.map((model) => (
            <ModelListItem key={model.id} model={model} onDoubleClick={() => onConfirm(model.id)} />
          ))}
        </RadioGroup>
      ) : null}
      <EmptyState size="sm" live className={showList ? "sr-only" : undefined}>
        {showList ? null : (
          <StatusMessage isSaving={isSaving} isLoading={isLoading} emptyLabel={emptyLabel} />
        )}
      </EmptyState>
    </div>
  );
}
