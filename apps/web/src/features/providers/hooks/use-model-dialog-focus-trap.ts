import { useRef, type RefCallback, type RefObject } from "react";
import { useFocusZone, useKey } from "@diffgazer/keys";

type FocusZone = "close" | "search" | "filters" | "list" | "footer";

const MODEL_DIALOG_ZONES = ["close", "search", "filters", "list", "footer"] as const;

interface UseModelDialogFocusTrapOptions {
  open: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  hasHandledInitialFocusRef: { current: boolean };
}

interface UseModelDialogFocusTrapResult {
  focusZone: FocusZone;
  setFocusZone: (zone: FocusZone) => void;
  isZone: (zone: FocusZone) => boolean;
  focusCloseButton: () => void;
  focusSearchInput: () => void;
  getCloseButtonProps: () => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
}

/**
 * Dialog focus-zone state plus the close-button boundary for the model dialog.
 * Owns the zone machine the rest of the dialog keyboard coordinates around.
 */
export function useModelDialogFocusTrap({
  open,
  searchInputRef,
  hasHandledInitialFocusRef,
}: UseModelDialogFocusTrapOptions): UseModelDialogFocusTrapResult {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { zone: focusZone, setZone: setFocusZone, isZone } = useFocusZone({
    initial: "list" as FocusZone,
    zones: MODEL_DIALOG_ZONES,
    enabled: open,
    scope: "model-dialog",
  });

  const focusSearchInput = () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  };

  const focusCloseButton = () => {
    setFocusZone("close");
    closeButtonRef.current?.focus();
  };

  const getCloseButtonProps = () => ({
    ref: (node: HTMLButtonElement | null) => {
      closeButtonRef.current = node;
    },
    onFocus: () => {
      if (!hasHandledInitialFocusRef.current) return;
      setFocusZone("close");
    },
  });

  useKey("ArrowDown", focusSearchInput, { enabled: open && isZone("close"), preventDefault: true });

  return { focusZone, setFocusZone, isZone, focusCloseButton, focusSearchInput, getCloseButtonProps };
}
