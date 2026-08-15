import { DECLINE, useActionRowNavigation, useKey } from "@diffgazer/keys";
import { type RefCallback, type RefObject, useRef } from "react";
import { isProviderActionDisabled, type ProviderAction } from "../lib/actions";
import type { ProvidersFocusZone } from "./use-keyboard";

interface UseProvidersActionButtonsOptions {
  /**
   * The page layer's single derived action row -- never recomputed here, so the keyboard row
   * and the rendered buttons address the same actions by the same indexes.
   */
  actions: readonly ProviderAction[];
  /** True while a list row is highlighted; without one there is nothing to act on. */
  hasSelection: boolean;
  dialogOpen: boolean;
  /** True while a provider mutation is in flight; the rendered buttons disable on it. */
  isPending: boolean;
  inButtons: boolean;
  setZone: (zone: ProvidersFocusZone) => void;
  focusProviderList: () => void;
  /** The page layer's single action dispatcher, shared with the rendered action row. */
  runAction: (action: ProviderAction) => void;
}

interface UseProvidersActionButtonsResult {
  buttonIndex: number;
  enterButtons: (index?: number) => void;
  /** Content element focus parks on while every action is disabled mid-mutation. */
  focusFallbackRef: RefObject<HTMLDivElement | null>;
  getActionButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
}

export function useProvidersActionButtons({
  actions,
  hasSelection,
  dialogOpen,
  isPending,
  inButtons,
  setZone,
  focusProviderList,
  runAction,
}: UseProvidersActionButtonsOptions): UseProvidersActionButtonsResult {
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  // Shares isProviderActionDisabled with the rendered row so focus custody sees what the DOM does.
  const disabledActions = actions.map((action) => isProviderActionDisabled(action, isPending));

  const handleButtonAction = (index: number) => {
    const action = actions[index];
    if (!hasSelection || !action || isProviderActionDisabled(action, isPending)) return;
    runAction(action);
  };

  const actionRow = useActionRowNavigation({
    enabled: !dialogOpen && inButtons,
    actionCount: actions.length,
    disabledActions,
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: handleButtonAction,
    onNavigationBoundaryReached: (direction) => {
      if (direction === "previous") {
        setZone("list");
        focusProviderList();
      }
    },
    wrap: false,
    defaultZone: "actions",
  });

  // The row's action list shrinks and grows with the selection, so a focused index taken from a
  // longer list can outlive it. Clamping during render keeps the highlighted button in range
  // without a second copy of the index to keep in sync.
  const focusedIndex = Math.min(actionRow.focusedIndex, actions.length - 1);

  const enterButtons = (index: number = 0) => {
    if (!hasSelection || actions.length === 0) return;
    setZone("buttons");
    actionRow.enterActions(index);
  };

  // A reason-disabled action is natively disabled by the renderer, so it neither
  // takes focus nor shows a title tooltip. The reason is announced through the
  // button's accessible name instead.
  const getActionButtonProps = (index: number) => {
    const actionProps = actionRow.getActionProps(index);
    return {
      ref: actionProps.ref,
      onFocus: () => {
        setZone("buttons");
        actionProps.onFocus();
      },
    };
  };

  const navigateButtonsVertical = (direction: 1 | -1) => {
    let next = focusedIndex + direction;
    while (next >= 0 && next < actions.length) {
      if (!disabledActions[next]) {
        actionRow.enterActions(next);
        return;
      }
      next += direction;
    }
    return DECLINE;
  };

  useKey("ArrowUp", () => navigateButtonsVertical(-1), {
    enabled: !dialogOpen && inButtons,
    preventDefault: true,
  });
  useKey("ArrowDown", () => navigateButtonsVertical(1), {
    enabled: !dialogOpen && inButtons,
    preventDefault: true,
  });

  return {
    buttonIndex: focusedIndex,
    enterButtons,
    focusFallbackRef,
    getActionButtonProps,
  };
}
