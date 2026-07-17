import {
  getFocusedNavigationValue,
  useFocusZone,
  useKey,
  useScopedNavigation,
} from "@diffgazer/keys";
import { type RefObject, useLayoutEffect, useRef } from "react";

export type TrustFormFocusZone = "list" | "buttons";
export type TrustFormAction = "save" | "revoke";

const TRUST_FORM_ZONES = ["list", "buttons"] as const;
const TRUST_FORM_ACTIONS = ["save", "revoke"] as const;

interface UseTrustFormKeyboardOptions {
  enabled?: boolean;
  actionsDisabled?: boolean;
  scope?: string;
  onListFocusRequest?: () => void;
  onSave?: () => void;
  onRevoke?: () => void;
  busyStatusRef?: RefObject<HTMLElement | null>;
}

function isTrustFormAction(value: string | null | undefined): value is TrustFormAction {
  return TRUST_FORM_ACTIONS.some((action) => action === value);
}

function getActionButton(container: HTMLElement | null, action: TrustFormAction) {
  return container?.querySelector<HTMLButtonElement>(`button[data-value="${action}"]`) ?? null;
}

function getFocusedAction(container: HTMLElement | null): TrustFormAction | null {
  const action = getFocusedNavigationValue(container, { type: "button", ownerSelector: null });
  return isTrustFormAction(action) ? action : null;
}

export function useTrustFormKeyboard({
  enabled = true,
  actionsDisabled = false,
  scope,
  onListFocusRequest,
  onSave,
  onRevoke,
  busyStatusRef,
}: UseTrustFormKeyboardOptions) {
  const actionRowRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const pendingActionRef = useRef<TrustFormAction | null>(null);
  const wasActionsDisabledRef = useRef(false);
  const keyboardEnabled = enabled && !actionsDisabled;
  const { zone, setZone, getKeyOptions } = useFocusZone<TrustFormFocusZone>({
    initial: "list",
    zones: TRUST_FORM_ZONES,
    enabled,
    scope,
    preventDefault: true,
    containerRef: actionRowRef,
    focusWithinOnly: true,
  });

  const { highlighted, highlight } = useScopedNavigation<TrustFormAction>({
    containerRef: actionRowRef,
    role: "button",
    defaultHighlighted: "save",
    orientation: "horizontal",
    moveFocus: true,
    wrap: false,
    enabled: keyboardEnabled && zone === "buttons",
    scope,
    focusWithinOnly: true,
  });
  const focusedAction = isTrustFormAction(highlighted) ? highlighted : "save";

  const enterListZone = () => {
    setZone("list");
    onListFocusRequest?.();
  };

  const handlePermissionFocus = () => {
    setZone("list");
  };

  const focusActionButton = (action: TrustFormAction = focusedAction) => {
    if (actionsDisabled) return;
    setZone("buttons");
    highlight(action);
    getActionButton(actionRowRef.current, action)?.focus();
  };

  const handleActionFocus = (action: TrustFormAction) => {
    if (actionsDisabled) return;
    setZone("buttons");
    highlight(action);
  };

  const activateAction = (action: TrustFormAction) => {
    if (actionsDisabled) return;
    pendingActionRef.current = action;
    restoreFocusRef.current = getActionButton(actionRowRef.current, action);
    if (action === "save") onSave?.();
    else onRevoke?.();
  };

  const activateCurrentAction = () => {
    activateAction(getFocusedAction(actionRowRef.current) ?? focusedAction);
  };

  useLayoutEffect(() => {
    const wasActionsDisabled = wasActionsDisabledRef.current;
    wasActionsDisabledRef.current = actionsDisabled;

    if (!wasActionsDisabled && actionsDisabled) {
      busyStatusRef?.current?.focus();
      return;
    }
    if (wasActionsDisabled && !actionsDisabled) {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
      pendingActionRef.current = null;
    }
  }, [actionsDisabled, busyStatusRef]);

  useKey("ArrowUp", enterListZone, getKeyOptions("buttons", { enabled: keyboardEnabled }));
  useKey(
    ["Enter", " "],
    activateCurrentAction,
    getKeyOptions("buttons", { enabled: keyboardEnabled }),
  );

  return {
    actionRowRef,
    focusZone: zone,
    focusedAction,
    handlePermissionFocus,
    focusActionButton,
    handleActionFocus,
    activateAction,
    pendingAction: pendingActionRef.current,
  };
}
