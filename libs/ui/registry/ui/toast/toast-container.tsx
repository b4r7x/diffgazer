"use client";

import { isEditableElement } from "@diffgazer/keys";
import { type FocusEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Toast } from "./toast";
import {
  dismiss,
  pause,
  remove,
  resume,
  type Toast as ToastData,
  type ToastPosition,
  useToastStore,
} from "./toast-store";
import { toastPositionVariants } from "./toast-variants";
import { useToastContainer } from "./use-container";

function handleBlur(e: FocusEvent<HTMLDivElement>) {
  const View = e.currentTarget.ownerDocument.defaultView;
  if (
    !View ||
    !(e.relatedTarget instanceof View.Node) ||
    !e.currentTarget.contains(e.relatedTarget)
  ) {
    resume();
  }
}

function supportsPopover(ownerDocument: Document): boolean {
  const HTMLElementCtor = ownerDocument.defaultView?.HTMLElement;
  return Boolean(HTMLElementCtor && "popover" in HTMLElementCtor.prototype);
}

function announcementText(toast: ToastData): string {
  return toast.message ? `${toast.title}, ${toast.message}` : toast.title;
}

/** Props for toaster. */
export interface ToasterProps {
  /** Corner where toasts stack. Drives positioning classes and slide-in direction. */
  position?: ToastPosition;
  /**
   * Key that moves DOM focus to the toast region so keyboard users can reach action/close
   * buttons before a timed toast disappears. Matched against `KeyboardEvent.key` and ignored
   * while an editable element has focus. Defaults to F8, the Radix viewport hotkey.
   */
  hotkey?: string;
}

/** Fixed-position container, subscribes to toast store. */
export function Toaster({ position = "bottom-right", hotkey = "F8" }: ToasterProps) {
  const { toasts, dismissingIds } = useToastStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  useToastContainer(toasts, dismissingIds, containerRef);
  const hasToasts = toasts.length > 0;

  // Persistent visually-hidden polite live region (the Radix announcer pattern):
  // mounted with the container so the live region exists before its first
  // announcement, then each newly added non-error toast's text is written into
  // it. Error toasts render role="alert" (assertive) and announce reliably on
  // insertion, so routing them through the polite region too would double-
  // announce; the polite region covers the role="status" toasts whose mount-
  // with-content node is unreliable across SR/browser pairs.
  const [announcement, setAnnouncement] = useState("");
  const announcedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const latestNew = toasts.findLast((t) => t.tone !== "error" && !announcedIds.current.has(t.id));
    if (latestNew) setAnnouncement(announcementText(latestNew));
    announcedIds.current = new Set(toasts.map((t) => t.id));
  }, [toasts]);

  useEffect(() => {
    const element = containerRef.current;
    const ownerDocument = element?.ownerDocument;
    if (!ownerDocument) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== hotkey || isEditableElement(event.target)) return;
      const region = containerRef.current;
      if (!region) return;
      event.preventDefault();
      region.focus();
    };
    ownerDocument.addEventListener("keydown", onKeyDown);
    return () => ownerDocument.removeEventListener("keydown", onKeyDown);
  }, [hotkey]);

  // Native <dialog>.showModal() raises the dialog into the browser top-layer,
  // which `z-index` cannot beat. Opting the container into the Popover API
  // puts the toast in the same top-layer. The attribute is set imperatively
  // (not in JSX) so that browsers without Popover support — and test
  // environments without the polyfill — continue to follow the original
  // `position: fixed` + `z-index` path instead of being hidden by the UA
  // stylesheet's `display: none` default.
  //
  // The popover is re-asserted both when the toast set transitions from empty
  // to non-empty AND whenever a dialog opens above it: the top-layer is ordered
  // by insertion time, and `showModal()` appends a dialog ABOVE a pre-existing
  // manual popover (manual popovers are exempt from showModal's hide-all). A
  // MutationObserver on `dialog[open]` re-runs hidePopover/showPopover so the
  // region rejoins the top-layer above the dialog, keeping toasts visible,
  // interactive, and announced for the whole dialog session.
  useEffect(() => {
    if (!hasToasts) return;
    const element = containerRef.current;
    const view = element?.ownerDocument.defaultView;
    if (!element || !view || !supportsPopover(element.ownerDocument)) return;
    if (element.popover !== "manual") element.popover = "manual";

    const promote = (): boolean => {
      if (element.matches(":popover-open")) element.hidePopover();
      try {
        element.showPopover();
        return true;
      } catch {
        element.removeAttribute("popover");
        return false;
      }
    };

    if (!promote()) return;

    const observer = new view.MutationObserver(promote);
    observer.observe(element.ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ["open"],
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (element.matches(":popover-open")) element.hidePopover();
      element.removeAttribute("popover");
    };
  }, [hasToasts]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="region" with aria-label is the standard toast live-region container; swapping to <section> would change the styling element and add a page landmark.
    <div
      ref={containerRef}
      role="region"
      aria-label="Notifications"
      tabIndex={-1}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={handleBlur}
      className={cn(
        // UA stylesheet for [popover] applies inset:0, margin:auto, fit-content
        // sizing, plus a default border/padding/background. Override those so
        // the existing corner positioning and transparent backdrop survive
        // when popover mode activates, without changing the non-popover path.
        "fixed z-[var(--z-toast)] flex gap-2 pointer-events-none outline-none",
        "[&[popover]]:m-0 [&[popover]]:p-0 [&[popover]]:max-w-none [&[popover]]:max-h-none [&[popover]]:w-auto [&[popover]]:h-auto",
        "[&[popover]]:bg-transparent [&[popover]]:border-0 [&[popover]]:overflow-visible",
        toastPositionVariants({ position }),
      )}
    >
      <span data-slot="toast-announcer" className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          {...t}
          position={position}
          onDismiss={dismiss}
          onRemove={remove}
          dismissing={dismissingIds.has(t.id)}
        />
      ))}
    </div>
  );
}
