"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { FOCUS_OUTLINE_INSET } from "@/lib/focus-outline";
import { cn } from "@/lib/utils";

// Below this the thumb is too small to read or grab.
const MIN_THUMB_PX = 24;

export const scrollAreaVariants = cva("relative rounded-[inherit]", {
  variants: {
    orientation: {
      vertical: "overflow-y-auto overflow-x-hidden",
      horizontal: "overflow-x-auto overflow-y-hidden",
      both: "overflow-auto",
    },
    scrollbar: {
      // Both classes are unlayered theme-base.css utilities so they win the
      // cascade against Tailwind's layered same-named utilities — a layered
      // arbitrary property here would silently lose to them.
      thin: "scrollbar-thin",
      // scrollbar-hide suppresses the native bar under (hover: hover) only,
      // per the repo policy that touch devices keep their native indicator.
      overlay: "scrollbar-hide",
    },
  },
  compoundVariants: [
    // The gutter reserves the vertical track so content does not reflow when
    // it appears; overlay mode exists to reclaim exactly that track, and a
    // horizontal-only region has no vertical track to reserve.
    { orientation: "vertical", scrollbar: "thin", className: "[scrollbar-gutter:stable]" },
    { orientation: "both", scrollbar: "thin", className: "[scrollbar-gutter:stable]" },
  ],
  defaultVariants: { orientation: "vertical", scrollbar: "thin" },
});

export type ScrollOrientation = NonNullable<VariantProps<typeof scrollAreaVariants>["orientation"]>;

export interface ScrollAreaProps extends ComponentPropsWithRef<"div"> {
  /** Axes that overflow. Other axes are clipped. */
  orientation?: ScrollOrientation;
  /**
   * When true and the region has an accessible name (aria-label or aria-labelledby), wires
   * Arrow/PageUp/PageDown/Home/End to scroll the container and applies role="region" with
   * tabIndex={0}.
   */
  keyboardScrollable?: boolean;
  /**
   * Hides the native scrollbar and floats a draggable thumb above the content, so rows can
   * run border-to-border instead of stopping at a reserved track. Applies only with the
   * vertical orientation — other orientations keep their native bar — and only on
   * hover-capable devices; touch keeps the native indicator. Renders a zero-height rail as
   * the container's first DOM child, ahead of children, so position-keyed styling on direct
   * children must account for it. The thumb hides when content fits.
   */
  overlay?: boolean;
}

/** Thin-scrollbar wrapper with vertical, horizontal, or both overflow directions. */
export function ScrollArea({
  children,
  className,
  orientation = "vertical",
  keyboardScrollable = true,
  overlay = false,
  ref,
  onKeyDown,
  onScroll,
  role: roleProp,
  tabIndex,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: ScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(
    null,
  );
  // Skips redundant style writes: parent renders resync more often than the
  // geometry actually changes, and only transform moves during a scroll.
  const lastThumbWrite = useRef("");
  const composedRef = useComposedRefs(ref, scrollRef);
  const canScrollV = orientation === "vertical" || orientation === "both";
  const canScrollH = orientation === "horizontal" || orientation === "both";
  // The overlay replaces only the vertical bar, so other orientations keep
  // their native scrollbar instead of losing it with no substitute.
  const overlayActive = overlay && orientation === "vertical";

  // Stable so the observer effect below can list it without remounting the
  // ResizeObserver on every render; it reads refs only.
  const updateOverlayThumb = useCallback(() => {
    const el = scrollRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;
    const { clientHeight, scrollHeight, scrollTop } = el;
    const maxScroll = scrollHeight - clientHeight;
    const height = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB_PX);
    // A track shorter than the minimum thumb would invert the travel math, so
    // such a region hides the thumb along with the content-fits case.
    const track = clientHeight - height;
    const offset = maxScroll <= 1 || track <= 0 ? null : (scrollTop / maxScroll) * track;
    const write = offset === null ? "hidden" : `${height}:${offset}`;
    if (write === lastThumbWrite.current) return;
    lastThumbWrite.current = write;
    if (offset === null) {
      thumb.style.display = "none";
      return;
    }
    thumb.style.display = "block";
    thumb.style.height = `${height}px`;
    thumb.style.transform = `translateY(${offset}px)`;
  }, []);

  useEffect(() => {
    if (!overlayActive) return;
    updateOverlayThumb();
    const el = scrollRef.current;
    // Feature-checked because the thumb is decoration: environments without
    // ResizeObserver (jsdom consumers) still scroll, they just skip resyncs.
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateOverlayThumb);
    observer.observe(el);
    return () => observer.disconnect();
  }, [overlayActive, updateOverlayThumb]);

  // Content can grow without the container resizing (rows stream in), and such
  // growth reaches this component as new children. The identity check overfires
  // — children are recreated on every parent render — but each resync costs one
  // layout read and, via the write cache above, usually zero style writes.
  // Growth that bypasses React entirely (an image loading inside an unchanged
  // child) is picked up on the next scroll or container resize instead.
  // biome-ignore lint/correctness/useExhaustiveDependencies: children is deliberately listed as the content-growth trigger; the callback reads live DOM refs, not children.
  useEffect(() => {
    if (overlayActive) updateOverlayThumb();
  }, [overlayActive, children, updateOverlayThumb]);
  const hasAccessibleName = Boolean(ariaLabel || ariaLabelledBy);
  const canKeyboardScroll = keyboardScrollable && hasAccessibleName;
  const role = roleProp ?? (hasAccessibleName ? "region" : undefined);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    // Inline on purpose: importing @diffgazer/keys here would make every
    // scroll-area-dependent item demand a keys integration at install time.
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target !== e.currentTarget) return;

    const el = e.currentTarget;
    const hasVerticalOverflow = canScrollV && el.scrollHeight > el.clientHeight;
    const hasHorizontalOverflow = canScrollH && el.scrollWidth > el.clientWidth;
    const pageStepV = el.clientHeight * 0.8;
    const pageStepH = el.clientWidth * 0.8;
    const pageScrollsHorizontal = orientation === "horizontal";

    switch (e.key) {
      case "ArrowUp":
        if (!hasVerticalOverflow) break;
        el.scrollTop -= 40;
        e.preventDefault();
        break;
      case "ArrowDown":
        if (!hasVerticalOverflow) break;
        el.scrollTop += 40;
        e.preventDefault();
        break;
      case "ArrowLeft":
        if (!hasHorizontalOverflow) break;
        el.scrollLeft -= 40;
        e.preventDefault();
        break;
      case "ArrowRight":
        if (!hasHorizontalOverflow) break;
        el.scrollLeft += 40;
        e.preventDefault();
        break;
      case "PageUp":
        if (pageScrollsHorizontal) {
          if (!hasHorizontalOverflow) break;
          el.scrollLeft -= pageStepH;
        } else if (hasVerticalOverflow) {
          el.scrollTop -= pageStepV;
        } else {
          break;
        }
        e.preventDefault();
        break;
      case "PageDown":
        if (pageScrollsHorizontal) {
          if (!hasHorizontalOverflow) break;
          el.scrollLeft += pageStepH;
        } else if (hasVerticalOverflow) {
          el.scrollTop += pageStepV;
        } else {
          break;
        }
        e.preventDefault();
        break;
      case "Home":
        if (!hasVerticalOverflow && !hasHorizontalOverflow) break;
        if (hasVerticalOverflow) el.scrollTop = 0;
        if (hasHorizontalOverflow) el.scrollLeft = 0;
        e.preventDefault();
        break;
      case "End":
        if (!hasVerticalOverflow && !hasHorizontalOverflow) break;
        if (hasVerticalOverflow) el.scrollTop = el.scrollHeight;
        if (hasHorizontalOverflow) el.scrollLeft = el.scrollWidth;
        e.preventDefault();
        break;
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the scroll container conditionally takes a scrollbar/region role and owns keyboard scrolling; Biome cannot resolve the dynamic role.
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label/aria-labelledby apply to the dynamic role assigned to this scroll region, which Biome cannot statically resolve.
    <div
      ref={composedRef}
      role={role}
      data-slot="scroll-area"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={canKeyboardScroll ? (tabIndex ?? 0) : tabIndex}
      onKeyDown={canKeyboardScroll ? handleKeyDown : onKeyDown}
      onScroll={
        overlayActive
          ? (event) => {
              onScroll?.(event);
              updateOverlayThumb();
            }
          : onScroll
      }
      className={cn(
        scrollAreaVariants({ orientation, scrollbar: overlayActive ? "overlay" : "thin" }),
        // Inset offset, not outset: this element is the scroll container, so an outline
        // drawn outside its padding box is clipped by whatever encloses it — the keyboard
        // focus indicator would vanish exactly where it is needed.
        canKeyboardScroll && FOCUS_OUTLINE_INSET,
        className,
      )}
      {...props}
    >
      {overlayActive ? (
        // Sticky zero-height rail: it pins to the visible top of the scroll
        // container, so the absolutely-positioned thumb floats above the rows
        // instead of occupying a track the way the native scrollbar does. It is
        // the container's first DOM child, ahead of {children} — documented on
        // the overlay prop. Color and the touch fallback live in theme-base.css
        // on the data-slot selectors; only measured geometry is written inline.
        <div
          aria-hidden="true"
          data-slot="scroll-area-overlay"
          className="pointer-events-none sticky top-0 z-10 h-0"
        >
          <div
            ref={thumbRef}
            data-slot="scroll-area-overlay-thumb"
            className="pointer-events-auto absolute top-0 right-[1px] w-[5px] rounded-[2px]"
            style={{ display: "none" }}
            onPointerDown={(event) => {
              const el = scrollRef.current;
              if (!el) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
                startScrollTop: el.scrollTop,
              };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              const el = scrollRef.current;
              if (!drag || drag.pointerId !== event.pointerId || !el) return;
              const { clientHeight, scrollHeight } = el;
              const height = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB_PX);
              const track = clientHeight - height;
              if (track <= 0) return;
              el.scrollTop =
                drag.startScrollTop +
                ((event.clientY - drag.startY) * (scrollHeight - clientHeight)) / track;
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
