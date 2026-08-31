import {
  type EndpointPoolContext,
  getModelBillingPool,
  poolBadgeLabel,
} from "@diffgazer/core/providers";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { getVerticalArrowDirection } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { RadioGroup } from "@diffgazer/ui/components/radio";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { ModelListItem } from "./list-item";

interface ModelListProps {
  models: ModelInfo[];
  /**
   * The product's billing pools. Absent for products whose endpoints are not
   * separate billing pools, which is what leaves the rows unbadged.
   */
  poolContext?: EndpointPoolContext | null;
  /** The armed pool, which decides only how a row both pools serve is badged. */
  armedPoolId?: string;
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

function StatusMessage({ loading, emptyLabel }: { loading: boolean; emptyLabel?: string }) {
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
  poolContext = null,
  armedPoolId,
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
  // The save window keeps the loaded list on screen (disabled); only a load
  // with nothing to show yet may replace it with the spinner.
  const showList = !loading && models.length > 0;

  return (
    // The dialog owns arrow-key navigation through the RadioGroup, so the scroll
    // region does not take focus or its own key handling.
    <ScrollArea
      ref={ref}
      keyboardScrollable={false}
      // The saving window disables every dialog control; focus leaving a
      // now-disabled button parks here instead of falling to document.body.
      tabIndex={isSaving ? -1 : undefined}
      // scroll-py mirrors py: without scroll-padding, navigation parks rows
      // flush with the clipped padding-box edge, which cuts the 1px focus ring
      // painted outside the row.
      className="min-h-0 flex-1 overscroll-contain px-5 py-3 scroll-py-3"
      data-layout-region="model-list"
    >
      {showList ? (
        <RadioGroup
          aria-label="Available models"
          disabled={isSaving}
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
          {models.map((model) => {
            const billingPool = getModelBillingPool(poolContext, model, armedPoolId);

            return (
              <ModelListItem
                key={model.id}
                model={model}
                poolBadgeLabel={poolBadgeLabel(billingPool)}
                onDoubleClick={() => onConfirm(model.id)}
              />
            );
          })}
        </RadioGroup>
      ) : null}
      {/* The dialog height is fixed, so filling the viewport centers the
          loading/empty message without moving anything when the list arrives. */}
      <EmptyState size="sm" live className={showList ? "sr-only p-0" : "h-full"}>
        {showList ? null : <StatusMessage loading={loading} emptyLabel={emptyLabel} />}
      </EmptyState>
    </ScrollArea>
  );
}
