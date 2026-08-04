import type { ProviderListRow } from "@diffgazer/core/providers";
import { DECLINE, useActionRowNavigation, useKey } from "@diffgazer/keys";
import { type RefCallback, type RefObject, useRef } from "react";
import { isProviderActionDisabled, type ProviderAction } from "../lib/actions";

interface UseProvidersActionButtonsOptions {
  /**
   * The page layer's single derived action row -- never recomputed here, so the keyboard row
   * and the rendered buttons address the same actions by the same indexes.
   */
  actions: readonly ProviderAction[];
  selectedRow: ProviderListRow | null;
  dialogOpen: boolean;
  /** True while a provider mutation is in flight; the rendered buttons disable on it. */
  isPending: boolean;
  inButtons: boolean;
  setZone: (zone: "input" | "filters" | "list" | "buttons") => void;
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
    "aria-disabled"?: boolean;
    title?: string;
  };
}

export function useProvidersActionButtons({
  actions,
  selectedRow,
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
    if (!selectedRow || !action || isProviderActionDisabled(action, isPending)) return;
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
    if (!selectedRow || actions.length === 0) return;
    setZone("buttons");
    actionRow.enterActions(index);
  };

  const getActionButtonProps = (index: number) => {
    const actionProps = actionRow.getActionProps(index);
    const disabledReason = actions[index]?.disabledReason;
    return {
      ref: actionProps.ref,
      onFocus: () => {
        setZone("buttons");
        actionProps.onFocus();
      },
      ...(disabledReason ? { "aria-disabled": true as const, title: disabledReason } : {}),
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
