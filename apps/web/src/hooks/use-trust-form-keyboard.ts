import { useCallback, useRef } from "react";
import { getFocusedNavigationValue, useFocusZone, useKey, useScopedNavigation } from "@diffgazer/keys";

export type TrustFormFocusZone = "list" | "buttons";
export type TrustFormAction = "save" | "revoke";

const TRUST_FORM_ZONES = ["list", "buttons"] as const;
const TRUST_FORM_ACTIONS = ["save", "revoke"] as const;

interface UseTrustFormKeyboardOptions {
  enabled?: boolean;
  scope?: string;
  onListFocusRequest?: () => void;
  onSave?: () => void;
  onRevoke?: () => void;
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
  scope,
  onListFocusRequest,
  onSave,
  onRevoke,
}: UseTrustFormKeyboardOptions) {
  const actionRowRef = useRef<HTMLDivElement>(null);
  const { zone, setZone, getKeyOptions } = useFocusZone<TrustFormFocusZone>({
    initial: "list",
    zones: TRUST_FORM_ZONES,
    enabled,
    scope,
    preventDefault: true,
    containerRef: actionRowRef,
    focusWithinOnly: true,
  });

  const { highlighted, highlight } = useScopedNavigation({
    containerRef: actionRowRef,
    role: "button",
    defaultHighlighted: "save",
    orientation: "horizontal",
    moveFocus: true,
    wrap: false,
    enabled: enabled && zone === "buttons",
    scope,
    focusWithinOnly: true,
  });
  const focusedAction = isTrustFormAction(highlighted)
    ? highlighted
    : "save";

  const enterListZone = useCallback(() => {
    setZone("list");
    onListFocusRequest?.();
  }, [onListFocusRequest, setZone]);

  const handlePermissionFocus = useCallback(() => {
    setZone("list");
  }, [setZone]);

  const focusActionButton = useCallback((action: TrustFormAction = focusedAction) => {
    setZone("buttons");
    highlight(action);
    getActionButton(actionRowRef.current, action)?.focus();
  }, [focusedAction, highlight, setZone]);

  const handleActionFocus = useCallback((action: TrustFormAction) => {
    setZone("buttons");
    highlight(action);
  }, [highlight, setZone]);

  const activateCurrentAction = useCallback(() => {
    const action = getFocusedAction(actionRowRef.current) ?? focusedAction;
    if (action === "save") onSave?.();
    else onRevoke?.();
  }, [focusedAction, onSave, onRevoke]);

  useKey("ArrowUp", enterListZone, getKeyOptions("buttons"));
  useKey(["Enter", " "], activateCurrentAction, getKeyOptions("buttons"));

  return {
    actionRowRef,
    focusZone: zone,
    focusedAction,
    handlePermissionFocus,
    focusActionButton,
    handleActionFocus,
  };
}
