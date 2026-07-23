"use client";

import {
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useEscapeKey, useOutsideClick } from "@/hooks/use-outside-click";

function isFocusInDescendantPopup(
  next: Node,
  content: HTMLElement,
  trigger: HTMLElement,
  ownerDocument: Document,
): boolean {
  const View = ownerDocument.defaultView;
  if (!View || !(next instanceof View.Element)) return false;
  const controlledIds = new Set<string>();
  for (const controller of ownerDocument.querySelectorAll<HTMLElement>("[aria-controls]")) {
    if (!content.contains(controller) && !trigger.contains(controller)) continue;
    const ids = controller.getAttribute("aria-controls")?.split(/\s+/) ?? [];
    for (const id of ids) controlledIds.add(id);
  }

  let current: Element | null = next;
  while (current) {
    if (current.id && controlledIds.has(current.id)) return true;
    current = current.parentElement;
  }
  return false;
}

export interface UsePopoverContentDismissalOptions {
  open: boolean;
  isClick: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  markDismissed: () => void;
  onOpenChange: (next: boolean) => void;
}

export interface UsePopoverContentDismissalReturn {
  onExitComplete: () => void;
  onFocusCaptureDismissal: () => void;
  onBlurCaptureDismissal: (event: FocusEvent<HTMLDivElement>) => void;
  onKeyDownDismissal: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function usePopoverContentDismissal({
  open,
  isClick,
  triggerRef,
  contentRef,
  markDismissed,
  onOpenChange,
}: UsePopoverContentDismissalOptions): UsePopoverContentDismissalReturn {
  const wasOpenRef = useRef(open);
  const restoreFocusAfterCloseRef = useRef(false);
  const dismissRequestedRef = useRef(false);
  const dismissResetRef = useRef<{ timer: number; view: Window } | null>(null);
  const pointerFocusTransferRef = useRef(false);
  const pointerResetRef = useRef<{ timer: number; view: Window } | null>(null);

  const requestClose = useCallback(
    (restoreFocus: boolean) => {
      if (dismissRequestedRef.current) return;
      dismissRequestedRef.current = true;
      const view =
        triggerRef.current?.ownerDocument.defaultView ??
        contentRef.current?.ownerDocument.defaultView;
      if (view) {
        const timer = view.setTimeout(() => {
          dismissResetRef.current = null;
          dismissRequestedRef.current = false;
        }, 0);
        dismissResetRef.current = { timer, view };
      } else {
        dismissRequestedRef.current = false;
      }
      markDismissed();
      onOpenChange(false);
      if (restoreFocus) triggerRef.current?.focus();
    },
    [contentRef, markDismissed, onOpenChange, triggerRef],
  );

  useEffect(
    () => () => {
      const pendingReset = dismissResetRef.current;
      if (pendingReset) pendingReset.view.clearTimeout(pendingReset.timer);
      const pendingPointerReset = pointerResetRef.current;
      if (pendingPointerReset) {
        pendingPointerReset.view.clearTimeout(pendingPointerReset.timer);
      }
    },
    [],
  );

  const isFocusWithinPopover = useCallback(() => {
    const content = contentRef.current;
    const trigger = triggerRef.current;
    const ownerDocument = content?.ownerDocument ?? trigger?.ownerDocument;
    const activeElement = ownerDocument?.activeElement;
    if (!activeElement) return false;
    return !!content?.contains(activeElement) || !!trigger?.contains(activeElement);
  }, [contentRef, triggerRef]);

  const onExitComplete = useCallback(() => {
    if (!restoreFocusAfterCloseRef.current) return;
    const trigger = triggerRef.current;
    const ownerDocument = trigger?.ownerDocument ?? contentRef.current?.ownerDocument;
    const activeElement = ownerDocument?.activeElement;
    if (activeElement && activeElement !== ownerDocument?.body) {
      if (trigger?.contains(activeElement)) restoreFocusAfterCloseRef.current = false;
      return;
    }
    trigger?.focus();
    restoreFocusAfterCloseRef.current = false;
  }, [contentRef, triggerRef]);

  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!wasOpen || open) return;
    const content = contentRef.current;
    const trigger = triggerRef.current;
    const ownerDocument = content?.ownerDocument ?? trigger?.ownerDocument;
    const activeElement = ownerDocument?.activeElement;
    const focusWithinPopover =
      !!activeElement && (!!content?.contains(activeElement) || !!trigger?.contains(activeElement));
    restoreFocusAfterCloseRef.current = focusWithinPopover;
    if (focusWithinPopover) {
      trigger?.focus();
      restoreFocusAfterCloseRef.current = false;
    }
  }, [contentRef, open, triggerRef]);

  // useOutsideClick/useEscapeKey read excludeRefs/options through internal refs,
  // so inline arrays/objects here no longer re-register the overlay-stack entry.
  useOutsideClick(
    contentRef,
    () => {
      requestClose(false);
    },
    open && isClick,
    [triggerRef],
  );

  useEscapeKey(
    (e) => {
      const shouldRestoreFocus = isFocusWithinPopover();
      e.preventDefault();
      if (shouldRestoreFocus) {
        e.stopPropagation();
      }
      requestClose(shouldRestoreFocus);
    },
    open,
    { ref: contentRef, excludeRefs: [triggerRef] },
  );

  useEffect(() => {
    if (!open || !isClick) return;
    const trigger = triggerRef.current;
    const content = contentRef.current;
    const ownerDocument = trigger?.ownerDocument ?? content?.ownerDocument;
    if (!ownerDocument || !trigger || !content) return;

    const handleFocusOut = (event: globalThis.FocusEvent) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const target = event.target;
      const View = ownerDocument.defaultView;
      const startedInPair =
        path.includes(trigger) ||
        path.includes(content) ||
        (!!View &&
          target instanceof View.Node &&
          (trigger.contains(target) || content.contains(target)));
      if (!startedInPair) return;
      if (pointerFocusTransferRef.current) return;

      const next = event.relatedTarget;
      if (View && next instanceof View.Node) {
        if (content.contains(next) || trigger.contains(next)) return;
        if (isFocusInDescendantPopup(next, content, trigger, ownerDocument)) return;
      }
      requestClose(false);
    };

    const handlePointerStart = () => {
      const pendingReset = pointerResetRef.current;
      if (pendingReset) pendingReset.view.clearTimeout(pendingReset.timer);
      pointerFocusTransferRef.current = true;
      const view = ownerDocument.defaultView;
      if (!view) {
        pointerFocusTransferRef.current = false;
        return;
      }
      const timer = view.setTimeout(() => {
        pointerResetRef.current = null;
        pointerFocusTransferRef.current = false;
      }, 0);
      pointerResetRef.current = { timer, view };
    };

    ownerDocument.addEventListener("focusout", handleFocusOut);
    ownerDocument.addEventListener("pointerdown", handlePointerStart, true);
    ownerDocument.addEventListener("mousedown", handlePointerStart, true);
    ownerDocument.addEventListener("touchstart", handlePointerStart, true);
    return () => {
      ownerDocument.removeEventListener("focusout", handleFocusOut);
      ownerDocument.removeEventListener("pointerdown", handlePointerStart, true);
      ownerDocument.removeEventListener("mousedown", handlePointerStart, true);
      ownerDocument.removeEventListener("touchstart", handlePointerStart, true);
    };
  }, [contentRef, open, isClick, requestClose, triggerRef]);

  const onFocusCaptureDismissal = useCallback(() => {
    restoreFocusAfterCloseRef.current = true;
  }, []);

  const onBlurCaptureDismissal = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;
      const content = contentRef.current;
      const trigger = triggerRef.current;
      const View = content?.ownerDocument.defaultView ?? trigger?.ownerDocument.defaultView;
      if (
        View &&
        next instanceof View.Node &&
        (content?.contains(next) || trigger?.contains(next))
      ) {
        return;
      }
      restoreFocusAfterCloseRef.current = false;
    },
    [contentRef, triggerRef],
  );

  const onKeyDownDismissal = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        const shouldRestoreFocus = isFocusWithinPopover();
        event.preventDefault();
        if (shouldRestoreFocus) {
          event.stopPropagation();
        }
        requestClose(shouldRestoreFocus);
      }
    },
    [isFocusWithinPopover, requestClose],
  );

  return {
    onExitComplete,
    onFocusCaptureDismissal,
    onBlurCaptureDismissal,
    onKeyDownDismissal,
  };
}
