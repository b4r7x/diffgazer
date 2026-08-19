import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { getVerticalArrowDirection } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { RadioGroup } from "@diffgazer/ui/components/radio";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
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
  loading?: boolean;
  isSaving?: boolean;
  /** Generic copy for an empty result set. Failure reasons belong to the dialog's alert row. */
  emptyLabel?: string;
  ref?: React.Ref<HTMLDivElement>;
}

function StatusMessage({
  loading,
  isSaving,
  emptyLabel,
}: {
  loading: boolean;
  isSaving: boolean;
  emptyLabel?: string;
}) {
  if (isSaving) {
    return (
      <>
        <Spinner variant="braille" size="sm" aria-hidden="true" />
        <EmptyState.Message>Saving...</EmptyState.Message>
      </>
    );
  }
  if (loading) {
    return (
      <>
        <Spinner variant="braille" size="sm" aria-hidden="true" />
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
  loading = false,
  isSaving = false,
  emptyLabel,
  ref,
}: ModelListProps) {
  const showList = !isSaving && !loading && models.length > 0;

  return (
    // The dialog owns arrow-key navigation through the RadioGroup, so the scroll
    // region does not take focus or its own key handling.
    <ScrollArea
      ref={ref}
      keyboardScrollable={false}
      // The saving window unmounts the radios and disables every other dialog
      // control, so the container itself parks programmatic focus beside the
      // Saving status instead of letting it fall to document.body.
      tabIndex={isSaving ? -1 : undefined}
      // scroll-py mirrors py: navigation scrolls rows flush with the clipped
      // padding-box edge, which cuts the 1px focus ring painted outside the row.
      className="max-h-[50dvh] overscroll-contain px-5 py-3 scroll-py-3"
      data-layout-region="model-list"
    >
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
      <EmptyState size="sm" live className={showList ? "sr-only p-0" : undefined}>
        {showList ? null : (
          <StatusMessage loading={loading} isSaving={isSaving} emptyLabel={emptyLabel} />
        )}
      </EmptyState>
    </ScrollArea>
  );
}
