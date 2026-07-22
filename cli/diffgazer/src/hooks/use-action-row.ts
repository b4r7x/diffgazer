import { useInput } from "ink";
import { useState } from "react";

export interface UseActionRowOptions {
  actionCount: number;
  disabledActions?: readonly boolean[];
  onAction: (index: number) => void;
  isActive?: boolean;
  defaultIndex?: number;
  activeIndex?: number;
  onNavigate?: (index: number) => void;
  verticalNavigation?: boolean;
  onExitUp?: () => void;
}

export interface ActionRow {
  activeIndex: number;
  isActionActive: (index: number) => boolean;
  activate: (index?: number) => void;
  reset: (index?: number) => void;
}

function isEnabled(index: number, actionCount: number, disabledActions: readonly boolean[]) {
  return index >= 0 && index < actionCount && !disabledActions[index];
}

export function getFirstEnabledAction(
  actionCount: number,
  disabledActions: readonly boolean[],
): number {
  for (let index = 0; index < actionCount; index += 1) {
    if (isEnabled(index, actionCount, disabledActions)) return index;
  }
  return 0;
}

function getNextEnabledAction({
  current,
  direction,
  actionCount,
  disabledActions,
}: {
  current: number;
  direction: 1 | -1;
  actionCount: number;
  disabledActions: readonly boolean[];
}): number {
  const fallback = isEnabled(current, actionCount, disabledActions)
    ? current
    : getFirstEnabledAction(actionCount, disabledActions);
  for (let next = fallback + direction; next >= 0 && next < actionCount; next += direction) {
    if (isEnabled(next, actionCount, disabledActions)) return next;
  }
  return fallback;
}

export function useActionRow({
  actionCount,
  disabledActions = [],
  onAction,
  isActive = true,
  defaultIndex = 0,
  activeIndex: controlledIndex,
  onNavigate,
  verticalNavigation = false,
  onExitUp,
}: UseActionRowOptions): ActionRow {
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const rawIndex = controlledIndex ?? internalIndex;
  const activeIndex = isEnabled(rawIndex, actionCount, disabledActions)
    ? rawIndex
    : getFirstEnabledAction(actionCount, disabledActions);

  function setActiveIndex(index: number) {
    if (controlledIndex === undefined) setInternalIndex(index);
    onNavigate?.(index);
  }

  function move(direction: 1 | -1) {
    setActiveIndex(
      getNextEnabledAction({ current: activeIndex, direction, actionCount, disabledActions }),
    );
  }

  function activate(index = activeIndex) {
    if (isEnabled(index, actionCount, disabledActions)) onAction(index);
  }

  function reset(index = defaultIndex) {
    const boundedIndex = actionCount === 0 ? 0 : Math.min(Math.max(index, 0), actionCount - 1);
    setActiveIndex(boundedIndex);
  }

  useInput(
    (_input, key) => {
      if (key.leftArrow || (verticalNavigation && key.upArrow)) {
        if (verticalNavigation && key.upArrow && onExitUp) {
          onExitUp();
          return;
        }
        move(-1);
        return;
      }
      if (key.rightArrow || (verticalNavigation && key.downArrow)) move(1);
    },
    { isActive },
  );

  return {
    activeIndex,
    isActionActive: (index) =>
      isActive && activeIndex === index && isEnabled(index, actionCount, disabledActions),
    activate,
    reset,
  };
}
