import { useInput } from "ink";
import { useState } from "react";

export interface UseActionRowOptions {
  actionCount: number;
  disabledActions?: readonly boolean[];
  /**
   * Optional: a caller that owns Enter itself (the settings screens read the
   * active index and run their own submit) leaves this out and never calls
   * `activate`.
   */
  onAction?: (index: number) => void;
  isActive?: boolean;
  defaultIndex?: number;
  activeIndex?: number;
  onNavigate?: (index: number) => void;
  verticalNavigation?: boolean;
  onExitUp?: () => void;
  onExitLeft?: () => void;
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
  onExitLeft,
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

  function move(direction: 1 | -1): boolean {
    const next = getNextEnabledAction({
      current: activeIndex,
      direction,
      actionCount,
      disabledActions,
    });
    if (next === activeIndex) return false;
    setActiveIndex(next);
    return true;
  }

  function activate(index = activeIndex) {
    if (isEnabled(index, actionCount, disabledActions)) onAction?.(index);
  }

  function reset(index = defaultIndex) {
    const boundedIndex = actionCount === 0 ? 0 : Math.min(Math.max(index, 0), actionCount - 1);
    setActiveIndex(boundedIndex);
  }

  useInput(
    (_input, key) => {
      if (verticalNavigation && (key.upArrow || key.downArrow)) {
        if (key.upArrow) onExitUp?.();
        return;
      }
      if (key.leftArrow) {
        if (!move(-1)) onExitLeft?.();
        return;
      }
      if (key.rightArrow) move(1);
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
