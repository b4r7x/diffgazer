"use client";

import { isEditableElement } from "@diffgazer/keys";
import { type FocusEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
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
    resume("focus");
  }
}

function supportsPopover(ownerDocument: Document): boolean {
  const HTMLElementCtor = ownerDocument.defaultView?.HTMLElement;
  return Boolean(HTMLElementCtor && "popover" in HTMLElementCtor.prototype);
}

function announcementText(toast: ToastData): string {
  return toast.message ? `${toast.title}, ${toast.message}` : toast.title;
}

const ANNOUNCEMENT_REMOVE_DELAY = 1000;

interface ToastAnnouncement {
  key: string;
  text: string;
}

interface ToasterStackSubscriber {
  ownerDocument: Document;
  onTopChange: (top: HTMLElement | null) => void;
}

const toasterStacks = new WeakMap<Document, HTMLElement[]>();
const toasterStackSubscribers = new Set<ToasterStackSubscriber>();

function getToasterStack(ownerDocument: Document): HTMLElement[] {
  let stack = toasterStacks.get(ownerDocument);
  if (!stack) {
    stack = [];
    toasterStacks.set(ownerDocument, stack);
  }
  return stack;
}

function notifyToasterStack(ownerDocument: Document): void {
  const top = getToasterStack(ownerDocument).at(-1) ?? null;
  for (const subscriber of toasterStackSubscribers) {
    if (subscriber.ownerDocument === ownerDocument) subscriber.onTopChange(top);
  }
}

function pushToaster(element: HTMLElement): void {
  const ownerDocument = element.ownerDocument;
  getToasterStack(ownerDocument).push(element);
  notifyToasterStack(ownerDocument);
}

function popToaster(element: HTMLElement): void {
  const ownerDocument = element.ownerDocument;
  const stack = getToasterStack(ownerDocument);
  const index = stack.lastIndexOf(element);
  if (index >= 0) stack.splice(index, 1);
  notifyToasterStack(ownerDocument);
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
  const [isTopToaster, setIsTopToaster] = useState(false);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const ownerDocument = element.ownerDocument;
    const subscriber: ToasterStackSubscriber = {
      ownerDocument,
      onTopChange: (top) => setIsTopToaster(top === element),
    };
    toasterStackSubscribers.add(subscriber);
    pushToaster(element);
    return () => {
      toasterStackSubscribers.delete(subscriber);
      popToaster(element);
      setIsTopToaster(false);
    };
  }, []);

  const visibleToasts = isTopToaster ? toasts : [];
  useToastContainer(visibleToasts, dismissingIds, containerRef, isTopToaster);
  const hasToasts = visibleToasts.length > 0;

  // Persistent visually-hidden polite live region (Radix announcer pattern):
  // exists before its first announcement, then each new non-error toast's text
  // is written in. Error toasts already announce via role="alert"; routing them
  // here too would double-announce.
  const [announcements, setAnnouncements] = useState<ToastAnnouncement[]>([]);
  const announcedIds = useRef<Set<string>>(new Set());
  const announcementSequence = useRef(0);
  const announcementTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const wasTopToaster = useRef(false);

  useEffect(() => {
    return () => {
      for (const timer of announcementTimers.current.values()) clearTimeout(timer);
      announcementTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isTopToaster) {
      wasTopToaster.current = false;
      announcedIds.current = new Set(toasts.map((t) => t.id));
      for (const timer of announcementTimers.current.values()) clearTimeout(timer);
      announcementTimers.current.clear();
      setAnnouncements((current) => (current.length > 0 ? [] : current));
      return;
    }

    const currentIds = new Set(toasts.map((t) => t.id));
    if (!wasTopToaster.current) {
      wasTopToaster.current = true;
      announcedIds.current = currentIds;
      return;
    }

    const nextAnnouncements: ToastAnnouncement[] = [];
    for (const toast of toasts) {
      if (toast.tone === "error" || announcedIds.current.has(toast.id)) continue;
      const key = `${toast.id}:${announcementSequence.current}`;
      announcementSequence.current += 1;
      nextAnnouncements.push({ key, text: announcementText(toast) });
    }
    announcedIds.current = currentIds;
    if (nextAnnouncements.length === 0) return;

    setAnnouncements((current) => [...current, ...nextAnnouncements]);
    for (const announcement of nextAnnouncements) {
      const timer = setTimeout(() => {
        announcementTimers.current.delete(announcement.key);
        setAnnouncements((current) => current.filter((item) => item.key !== announcement.key));
      }, ANNOUNCEMENT_REMOVE_DELAY);
      announcementTimers.current.set(announcement.key, timer);
    }
  }, [isTopToaster, toasts]);

  useEffect(() => {
    if (!isTopToaster) return;
    const element = containerRef.current;
    const ownerDocument = element?.ownerDocument;
    if (!ownerDocument) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== hotkey) return;
      // Shadow DOM retargets event.target to the host on the document listener;
      // composedPath()[0] is the real inner target so a focused input/select in
      // an open shadow tree still defers the shortcut.
      const target = event.composedPath()[0] ?? event.target;
      if (isEditableElement(target)) return;
      const region = containerRef.current;
      if (!region) return;
      event.preventDefault();
      region.focus();
    };
    ownerDocument.addEventListener("keydown", onKeyDown);
    return () => ownerDocument.removeEventListener("keydown", onKeyDown);
  }, [hotkey, isTopToaster]);

  // <dialog>.showModal() raises the dialog into the browser top-layer, which
  // z-index cannot beat; opting the container into the Popover API puts the
  // toast in the same top-layer. Set imperatively (not in JSX) so browsers/tests
  // without Popover support keep the plain fixed+z-index path instead of being
  // hidden by the UA stylesheet's display:none.
  //
  // showModal() appends a dialog ABOVE a pre-existing manual popover (which is
  // exempt from its hide-all), so a MutationObserver on dialog[open] re-runs
  // hidePopover/showPopover to rejoin the top-layer above the dialog.
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

  if (!isTopToaster)
    // biome-ignore lint/a11y/useSemanticElements: matches the active toast container element while preserving the hidden placeholder for stack registration.
    return <div ref={containerRef} role="region" aria-label="Notifications" hidden />;

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="region" with aria-label is the standard toast live-region container; swapping to <section> would change the styling element and add a page landmark.
    <div
      ref={containerRef}
      role="region"
      aria-label="Notifications"
      tabIndex={-1}
      onMouseEnter={() => pause("hover")}
      onMouseLeave={() => resume("hover")}
      onFocus={() => pause("focus")}
      onBlur={handleBlur}
      className={cn(
        // Override the UA [popover] stylesheet (inset:0, margin:auto, fit-content,
        // border/padding/background) so corner positioning and the transparent
        // backdrop survive when popover mode activates.
        "fixed z-[var(--z-toast)] flex gap-2 pointer-events-none outline-none",
        "[&[popover]]:m-0 [&[popover]]:p-0 [&[popover]]:max-w-none [&[popover]]:max-h-none [&[popover]]:w-auto [&[popover]]:h-auto",
        "[&[popover]]:bg-transparent [&[popover]]:border-0 [&[popover]]:overflow-visible",
        toastPositionVariants({ position }),
      )}
    >
      <span data-slot="toast-announcer" className="sr-only" aria-live="polite">
        {announcements.map((announcement) => (
          <span key={announcement.key} data-slot="toast-announcement">
            {announcement.text}
          </span>
        ))}
      </span>
      {visibleToasts.map((t) => (
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
