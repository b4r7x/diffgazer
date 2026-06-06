"use client";

import { type FocusEvent, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Toast } from "./toast";
import { dismiss, pause, remove, resume, type ToastPosition, useToastStore } from "./toast-store";
import { toastPositionVariants } from "./toast-variants";
import { useToastContainer } from "./use-container";

function handleBlur(e: FocusEvent<HTMLDivElement>) {
  if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) resume();
}

function supportsPopover(): boolean {
  return typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
}

export interface ToasterProps {
  position?: ToastPosition;
}

export function Toaster({ position = "bottom-right" }: ToasterProps) {
  const { toasts, dismissingIds } = useToastStore();
  useToastContainer(toasts, dismissingIds);
  const hasToasts = toasts.length > 0;
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Native <dialog>.showModal() raises the dialog into the browser top-layer,
  // which `z-index` cannot beat. Opting the container into the Popover API
  // puts the toast in the same top-layer. The attribute is set imperatively
  // (not in JSX) so that browsers without Popover support — and test
  // environments without the polyfill — continue to follow the original
  // `position: fixed` + `z-index` path instead of being hidden by the UA
  // stylesheet's `display: none` default.
  //
  // The popover is re-opened whenever the toast set transitions from empty
  // to non-empty so it joins the top-layer AFTER any dialog opened in the
  // meantime; the top-layer is ordered by insertion time, and the most
  // recent entry paints on top.
  useEffect(() => {
    if (!hasToasts) return;
    const element = containerRef.current;
    if (!element || !supportsPopover()) return;
    if (element.popover !== "manual") element.popover = "manual";
    if (element.matches(":popover-open")) element.hidePopover();
    try {
      element.showPopover();
    } catch {
      element.removeAttribute("popover");
      return;
    }
    return () => {
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
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={handleBlur}
      className={cn(
        // UA stylesheet for [popover] applies inset:0, margin:auto, fit-content
        // sizing, plus a default border/padding/background. Override those so
        // the existing corner positioning and transparent backdrop survive
        // when popover mode activates, without changing the non-popover path.
        "fixed z-[var(--z-toast)] flex gap-2 pointer-events-none",
        "[&[popover]]:m-0 [&[popover]]:p-0 [&[popover]]:max-w-none [&[popover]]:max-h-none [&[popover]]:w-auto [&[popover]]:h-auto",
        "[&[popover]]:bg-transparent [&[popover]]:border-0 [&[popover]]:overflow-visible",
        toastPositionVariants({ position }),
      )}
    >
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
