import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { getVerticalArrowDirection } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { RadioGroup } from "@diffgazer/ui/components/radio";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { ModelListItem } from "./list-item";

type DiscoveryStatus = "idle" | "loading" | "passed" | "skipped" | "error";

interface ModelListProps {
  models: ModelInfo[];
  focusedModelId: string | null;
  currentModelId?: string;
  isFocused: boolean;
  onSelect: (modelId: string) => void;
  onConfirm: (modelId?: string) => void;
  onHighlightChange: (modelId: string | null) => void;
  onBoundaryReached: (direction: "previous" | "next") => void;
  discoveryStatus?: DiscoveryStatus;
  discoveryReason?: string | null;
  discoveryError?: string | null;
  isSaving?: boolean;
  emptyLabel?: string;
  ref?: React.Ref<HTMLDivElement>;
}

function StatusMessage({
  discoveryStatus,
  isSaving,
  discoveryReason,
  discoveryError,
  emptyLabel,
}: {
  discoveryStatus: DiscoveryStatus;
  isSaving: boolean;
  discoveryReason?: string | null;
  discoveryError?: string | null;
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
  if (discoveryStatus === "loading" || discoveryStatus === "idle") {
    return (
      <>
        <Spinner variant="braille" size="sm" aria-hidden="true" />
        <EmptyState.Message>Loading models...</EmptyState.Message>
      </>
    );
  }
  if (discoveryStatus === "error" && discoveryError) {
    return <EmptyState.Message>{discoveryError}</EmptyState.Message>;
  }
  if (discoveryStatus === "skipped" && discoveryReason) {
    return <EmptyState.Message>{discoveryReason}</EmptyState.Message>;
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
  discoveryStatus = "passed",
  discoveryReason = null,
  discoveryError = null,
  isSaving = false,
  emptyLabel,
  ref,
}: ModelListProps) {
  const showList = !isSaving && discoveryStatus === "passed" && models.length > 0;

  return (
    // The dialog owns arrow-key navigation through the RadioGroup, so the scroll
    // region does not take focus or its own key handling.
    <ScrollArea
      ref={ref}
      keyboardScrollable={false}
      className="max-h-[50dvh] overscroll-contain px-5 py-3"
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
      <EmptyState size="sm" live className={showList ? "sr-only" : undefined}>
        {showList ? null : (
          <StatusMessage
            discoveryStatus={discoveryStatus}
            isSaving={isSaving}
            discoveryReason={discoveryReason}
            discoveryError={discoveryError}
            emptyLabel={emptyLabel}
          />
        )}
      </EmptyState>
    </ScrollArea>
  );
}
