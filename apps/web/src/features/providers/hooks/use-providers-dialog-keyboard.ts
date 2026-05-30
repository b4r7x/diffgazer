import { useEffect, type RefObject } from "react";

interface UseProvidersDialogKeyboardOptions {
  dialogOpen: boolean;
  listReady: boolean;
  listContainerRef: RefObject<HTMLDivElement | null>;
  setZone: (zone: "input" | "filters" | "list" | "buttons") => void;
}

/**
 * Reclaims focus to the provider list once a dialog closes or the list becomes
 * ready, but only when focus is unclaimed or already inside the list so it does
 * not steal focus from another control.
 */
export function useProvidersDialogKeyboard({
  dialogOpen,
  listReady,
  listContainerRef,
  setZone,
}: UseProvidersDialogKeyboardOptions) {
  useEffect(() => {
    if (dialogOpen || !listReady) return;
    const listContainer = listContainerRef.current;
    if (!listContainer) return;
    const ownerDocument = listContainer.ownerDocument;
    const activeElement = ownerDocument.activeElement;
    const View = ownerDocument.defaultView;
    const focusIsUnclaimed = activeElement === ownerDocument.body || activeElement === ownerDocument.documentElement;
    const focusIsWithinList = Boolean(View && activeElement instanceof View.Node && listContainer.contains(activeElement));
    if (!focusIsUnclaimed && !focusIsWithinList) return;

    setZone("list");
    listContainer.focus();
  }, [dialogOpen, listReady, listContainerRef, setZone]);
}
