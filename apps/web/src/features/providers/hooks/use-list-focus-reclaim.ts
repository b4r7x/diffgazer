import { containsActiveElement } from "@diffgazer/keys";
import { type RefObject, useEffect } from "react";

interface UseProvidersListFocusReclaimOptions {
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
export function useProvidersListFocusReclaim({
  dialogOpen,
  listReady,
  listContainerRef,
  setZone,
}: UseProvidersListFocusReclaimOptions) {
  useEffect(() => {
    if (dialogOpen || !listReady) return;
    const listContainer = listContainerRef.current;
    if (!listContainer) return;
    const ownerDocument = listContainer.ownerDocument;
    const activeElement = ownerDocument.activeElement;
    const focusIsUnclaimed =
      activeElement === ownerDocument.body || activeElement === ownerDocument.documentElement;
    if (!focusIsUnclaimed && !containsActiveElement(listContainer)) return;

    setZone("list");
    listContainer.focus({ preventScroll: true });
  }, [dialogOpen, listReady, listContainerRef, setZone]);
}
