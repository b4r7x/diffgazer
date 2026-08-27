import { isProviderControlDisabled, type ProviderRowControl } from "@diffgazer/core/providers";
import { DECLINE, useActionRowNavigation, useKey } from "@diffgazer/keys";
import type { RefCallback, RefObject } from "react";
import type { ProvidersFocusZone } from "./use-keyboard";

interface UseProvidersActionButtonsOptions {
  /**
   * The rendered row's controls -- never recomputed here, so the keyboard row and the
   * rendered buttons address the same controls by the same indexes.
   */
  controls: readonly ProviderRowControl[];
  /** True while a list row is highlighted; without one there is nothing to act on. */
  hasSelection: boolean;
  dialogOpen: boolean;
  /** True while a provider mutation is in flight; the rendered buttons disable on it. */
  isPending: boolean;
  inButtons: boolean;
  /** Content element focus parks on while every action is disabled mid-mutation. */
  focusFallbackRef: RefObject<HTMLDivElement | null>;
  consentLinkRef: RefObject<HTMLButtonElement | null>;
  setZone: (zone: ProvidersFocusZone) => void;
  focusProviderList: () => void;
  /** The page layer's single control dispatcher, shared with the rendered action row. */
  runControl: (control: ProviderRowControl) => void;
}

interface UseProvidersActionButtonsResult {
  buttonIndex: number;
  enterButtons: (index?: number) => void;
  getActionButtonProps: (index: number) => {
    ref: RefCallback<HTMLElement>;
    onFocus: () => void;
  };
}

export function useProvidersActionButtons({
  controls,
  hasSelection,
  dialogOpen,
  isPending,
  inButtons,
  focusFallbackRef,
  consentLinkRef,
  setZone,
  focusProviderList,
  runControl,
}: UseProvidersActionButtonsOptions): UseProvidersActionButtonsResult {
  // Shares isProviderControlDisabled with the rendered row so focus custody sees what the DOM does.
  const disabledActions = controls.map((control) => isProviderControlDisabled(control, isPending));

  const handleButtonAction = (index: number) => {
    const control = controls[index];
    if (!hasSelection || !control || isProviderControlDisabled(control, isPending)) return;
    runControl(control);
  };

  const actionRow = useActionRowNavigation({
    enabled: !dialogOpen && inButtons,
    actionCount: controls.length,
    disabledActions,
    // A completed mutation rebuilds the row in place, so an index survives
    // while the control behind it does not; ids let the row see that and
    // repair the dropped focus.
    actionIds: controls.map((control) => control.id),
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

  // The row's control list shrinks and grows with the selection, so a focused index taken from a
  // longer list can outlive it. Clamping during render keeps the highlighted button in range
  // without a second copy of the index to keep in sync.
  const focusedIndex = Math.min(actionRow.focusedIndex, controls.length - 1);

  const enterButtons = (index: number = 0) => {
    if (!hasSelection || controls.length === 0) return;
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
    while (next >= 0 && next < controls.length) {
      if (!disabledActions[next]) {
        actionRow.enterActions(next);
        return;
      }
      next += direction;
    }
    if (direction === 1 && consentLinkRef.current) {
      setZone("details");
      consentLinkRef.current.focus();
      return;
    }
    return DECLINE;
  };

  const handleButtonsVertical = (direction: 1 | -1) => () => {
    if (!actionRow.isRegisteredActionFocused()) return DECLINE;
    return navigateButtonsVertical(direction);
  };

  useKey("ArrowUp", handleButtonsVertical(-1), {
    enabled: !dialogOpen && inButtons,
    preventDefault: true,
  });
  useKey("ArrowDown", handleButtonsVertical(1), {
    enabled: !dialogOpen && inButtons,
    preventDefault: true,
  });

  useKey(
    "ArrowUp",
    (event) => {
      const link = consentLinkRef.current;
      if (!link || event.target !== link) return DECLINE;
      const lastEnabled = disabledActions.lastIndexOf(false);
      if (lastEnabled === -1) return DECLINE;
      enterButtons(lastEnabled);
      return;
    },
    { enabled: !dialogOpen, preventDefault: true },
  );

  return {
    buttonIndex: focusedIndex,
    enterButtons,
    getActionButtonProps,
  };
}
