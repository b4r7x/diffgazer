"use client";

import {
  getRestorableFocusTarget,
  getTabbableElements,
  isEditableElement,
  restoreFocus,
} from "@diffgazer/keys";
import { type FocusEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { useTopLayerPosition } from "@/hooks/use-top-layer-position";
import { FOCUS_OUTLINE } from "@/lib/focus-outline";
import { createTopLayerStack } from "@/lib/top-layer-stack";
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

function focusLeftRegion(e: FocusEvent<HTMLDivElement>): boolean {
  const View = e.currentTarget.ownerDocument.defaultView;
  return (
    !View || !(e.relatedTarget instanceof View.Node) || !e.currentTarget.contains(e.relatedTarget)
  );
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

const toasterStack = createTopLayerStack();

let activeRegionEntry: (() => boolean) | null = null;

/**
 * Moves DOM focus into the active toast region, remembering the opener so
 * Escape or an arrow past the region's edge returns focus where it was.
 * Returns false while no toast is mounted. This is the entry persistent toasts
 * are wired to; timed toasts stay on the hotkey (focus arriving around a timer
 * unmount would strand the user).
 */
export function focusToastRegion(): boolean {
  return activeRegionEntry?.() ?? false;
}

export interface ToasterProps {
  /** Corner where toasts stack. Drives positioning classes and slide-in direction. */
  position?: ToastPosition;
  /**
   * Key that moves DOM focus to the toast region. For timed toasts this hotkey (or Tab)
   * is the intended keyboard route — they are exempt from arrow entry because focus on a
   * timer-unmounted element would strand the user; persistent toasts are additionally
   * entered through `focusToastRegion`, and inside the region ArrowUp/ArrowDown walk the
   * controls either way. Matched against `KeyboardEvent.key` and ignored while an editable
   * element has focus. Defaults to F8, the Radix viewport hotkey.
   */
  hotkey?: string;
  /** Accessible name for the toast region landmark. */
  label?: string;
}

/** Fixed-position container, subscribes to toast store. */
export function Toaster({
  position = "bottom-right",
  hotkey = "F8",
  label = "Notifications",
}: ToasterProps) {
  const { toasts, dismissingIds } = useToastStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isTopToaster = useTopLayerPosition(toasterStack, containerRef, true);
  // The hotkey inspection remembers its own opener rather than pushing onto
  // useFocusRestore's per-document stack: that stack is shared with dialogs,
  // and an inspection the user simply tabs away from would strand an entry
  // there that outranks and silently defeats the next dialog's restore.
  const inspectionOpener = useRef<HTMLElement | null>(null);
  // Removing a focused toast moves activeElement to body without firing any
  // blur event, so blur tracking alone cannot distinguish "the focused toast
  // was removed" from "the user moved focus elsewhere". This ref keeps that
  // distinction: it only flips false when a blur actually leaves the region.
  const regionHadFocus = useRef(false);

  const endInspection = (restore: boolean): boolean => {
    const opener = inspectionOpener.current;
    inspectionOpener.current = null;
    return restore && restoreFocus(opener);
  };

  const enterRegion = useEffectEvent((): boolean => {
    const region = containerRef.current;
    if (!region) return false;
    const ownerDocument = region.ownerDocument;
    // A repeated entry while focus is already inside the region must not
    // clobber the original opener with the region itself.
    if (!region.contains(ownerDocument.activeElement)) {
      inspectionOpener.current = getRestorableFocusTarget(ownerDocument);
    }
    region.focus();
    return ownerDocument.activeElement === region;
  });

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
      const rendersAlert = toast.tone === "error" && toast.variant !== "hud";
      if (rendersAlert || announcedIds.current.has(toast.id)) continue;
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
      if (event.defaultPrevented) return;
      if (event.key !== hotkey) return;
      // Shadow DOM retargets event.target to the host on the document listener;
      // composedPath()[0] is the real inner target so a focused input/select in
      // an open shadow tree still defers the shortcut.
      const target = event.composedPath()[0] ?? event.target;
      if (isEditableElement(target)) return;
      if (!containerRef.current) return;
      event.preventDefault();
      enterRegion();
    };
    ownerDocument.addEventListener("keydown", onKeyDown);
    return () => ownerDocument.removeEventListener("keydown", onKeyDown);
  }, [hotkey, isTopToaster]);

  useEffect(() => {
    if (!isTopToaster || !hasToasts) return;
    const entry = () => enterRegion();
    activeRegionEntry = entry;
    return () => {
      if (activeRegionEntry === entry) activeRegionEntry = null;
    };
  }, [isTopToaster, hasToasts]);

  // The always-mounted region would otherwise keep focus parked on an empty
  // live-region container after the last toast is removed. Restore only while
  // the region still owns focus: removal drops activeElement to body, so any
  // other focused element means the user already moved on.
  const restoreFocusFromEmptyRegion = useEffectEvent(() => {
    const region = containerRef.current;
    if (!region) return;
    const active = region.ownerDocument.activeElement;
    if (active && active !== region.ownerDocument.body && !region.contains(active)) return;
    if (endInspection(true)) regionHadFocus.current = false;
  });

  useEffect(() => {
    if (hasToasts || !regionHadFocus.current) return;
    restoreFocusFromEmptyRegion();
  }, [hasToasts]);

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
    return <div ref={containerRef} role="region" aria-label={label} hidden />;

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="region" with aria-label is the standard toast live-region container; swapping to <section> would change the styling element and add a page landmark.
    <div
      ref={containerRef}
      role="region"
      aria-label={label}
      tabIndex={-1}
      onMouseEnter={() => pause("hover")}
      onMouseLeave={() => resume("hover")}
      onFocus={() => {
        regionHadFocus.current = true;
        pause("focus");
      }}
      onBlur={(e) => {
        if (!focusLeftRegion(e)) return;
        regionHadFocus.current = false;
        // The user left on their own, so the inspection is over: drop the
        // opener instead of holding it for a restore that must never happen.
        endInspection(false);
        resume("focus");
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.nativeEvent.isComposing) return;
        // Escape exits the inspection: it returns focus to where it was before
        // the entry and consumes the key, so app-level Escape handlers (back
        // navigation) cannot also fire from inside the region. Consuming it
        // also skips the overlay-dismiss layer for this press — toasts stay
        // visible; dismissal stays on the close buttons and timeouts.
        if (event.key === "Escape") {
          event.preventDefault();
          endInspection(true);
          return;
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        if (isEditableElement(event.target)) return;
        const region = event.currentTarget;
        const chain: HTMLElement[] = [region, ...getTabbableElements(region)];
        const index = chain.indexOf(region.ownerDocument.activeElement as HTMLElement);
        if (index === -1) return;
        event.preventDefault();
        const next = chain[index + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) next.focus();
        else endInspection(true);
      }}
      className={cn(
        // Override the UA [popover] stylesheet (inset:0, margin:auto, fit-content,
        // border/padding/background) so corner positioning and the transparent
        // backdrop survive when popover mode activates.
        // The hotkey focuses this region programmatically, so it needs a visible
        // focus indicator; mouse interaction never matches :focus-visible.
        "fixed z-[var(--z-toast)] flex gap-2 pointer-events-none",
        FOCUS_OUTLINE,
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
