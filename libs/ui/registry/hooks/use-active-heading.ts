"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

/** Heading activation line mode. A number sets a custom viewport fraction from 0 to 1. */
export type ActiveHeadingActivation = "top-line" | "viewport-center" | (number & {});

/**
 * Tracks the currently active heading by id.
 *
 * Headings and viewport metrics resolve against `ownerDocument` (default: the
 * ambient `document`). Pass `ownerDocument` to track headings inside an iframe
 * or other secondary document; the hook reads its `defaultView` for viewport
 * size, scroll position, `matchMedia`, and resize listeners. It does not cross
 * document boundaries on its own — one hook tracks one document.
 */
export interface UseActiveHeadingOptions {
  /** Ordered list of heading element IDs to observe. Elements are resolved via document.getElementById. */
  ids: string[];
  /** ID of a scrollable container element. When omitted, the window is used as the scroll target. */
  containerId?: string;
  /**
   * How headings activate. "top-line" activates when crossing topOffset from container top.
   * "viewport-center" activates at the vertical center. A number sets a custom viewport fraction.
   *
   * @default "top-line"
   */
  activation?: ActiveHeadingActivation;
  /** Pixel offset from the container top used by the "top-line" activation mode. @default 96 */
  topOffset?: number;
  /** Pixel offset applied when scrollTo programmatically scrolls to a heading. Defaults to topOffset. */
  scrollOffset?: number;
  /** Fraction of viewport height used as bottom margin for bottomLock detection. @default 0 */
  bottomMargin?: number;
  /** Fraction of the heading height that must cross the activation line before it becomes active. @default 0 */
  threshold?: number;
  /** When true, the last heading is always activated when the user scrolls to the bottom of the container. @default true */
  bottomLock?: boolean;
  /** Set to false to disable scroll observation. When disabled, activeId is set to null. @default true */
  enabled?: boolean;
  /** Milliseconds to wait after a programmatic scrollTo before resuming scroll tracking. @default 150 */
  settleDelay?: number;
  /** Watch for DOM changes via MutationObserver. Disable for static content. @default true */
  observe?: boolean;
  /** Document to resolve headings and viewport metrics against. @default the ambient `document` */
  ownerDocument?: Document;
}

/** Current heading state and an imperative scroll helper. */
export interface UseActiveHeadingReturn {
  /** ID of the currently active heading, or null when disabled or no headings are found. */
  activeId: string | null;
  /** Scrolls to the heading with the given ID and pins activeId during the scroll animation. */
  scrollTo: (id: string) => void;
}

function isOwnerHTMLElement(doc: Document, value: unknown): value is HTMLElement {
  const ctor = doc.defaultView?.HTMLElement;
  return ctor ? value instanceof ctor : false;
}

function getContainer(doc: Document, id: string | undefined): HTMLElement | null {
  if (!id) return null;
  const el = doc.getElementById(id);
  return isOwnerHTMLElement(doc, el) ? el : null;
}

function getViewportMetrics(doc: Document, container: HTMLElement | null) {
  if (container) {
    return {
      top: container.getBoundingClientRect().top,
      height: container.clientHeight,
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
    };
  }

  const view = doc.defaultView;
  const root = doc.documentElement;
  const body = doc.body;
  const scrollTop = (view?.scrollY ?? 0) || root.scrollTop || body?.scrollTop || 0;
  const scrollHeight = Math.max(root.scrollHeight, body?.scrollHeight ?? 0);

  return {
    top: 0,
    height: view?.innerHeight ?? 0,
    scrollTop,
    scrollHeight,
  };
}

function findLastAbove(elements: HTMLElement[], line: number, thresholdRatio = 0): string | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.top + rect.height * thresholdRatio <= line) return element.id;
  }
  return null;
}

function resolveScrollBehavior(view: (Window & typeof globalThis) | null): ScrollBehavior {
  return view &&
    typeof view.matchMedia === "function" &&
    view.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function resolveActivationLine(
  top: number,
  height: number,
  activation: ActiveHeadingActivation,
  topOffset: number,
): number {
  if (typeof activation === "number") {
    return top + height * Math.max(0, Math.min(1, activation));
  }
  if (activation === "viewport-center") return top + height / 2;
  return top + topOffset;
}

/** Configurable active heading detection for table-of-contents navigation. */
export function useActiveHeading({
  ids,
  containerId,
  activation = "top-line",
  topOffset = 96,
  scrollOffset = topOffset,
  bottomMargin = 0,
  threshold = 0,
  bottomLock = true,
  enabled = true,
  settleDelay = 150,
  observe = true,
  ownerDocument,
}: UseActiveHeadingOptions): UseActiveHeadingReturn {
  const doc = ownerDocument ?? (typeof document !== "undefined" ? document : null);
  const idsKey = ids.join("\0");
  const [activeId, setActiveId] = useState<string | null>(() =>
    enabled ? (ids[0] ?? null) : null,
  );
  const [settleSignal, setSettleSignal] = useState(0);
  const scrollingToRef = useRef<string | null>(null);
  const settleTimerRef = useRef<number>(0);
  const update = useEffectEvent((): void => {
    if (doc === null || scrollingToRef.current !== null) return;

    const container = getContainer(doc, containerId);
    const elements = ids
      .map((id) => doc.getElementById(id))
      .filter((el): el is HTMLElement => isOwnerHTMLElement(doc, el));

    if (elements.length === 0) {
      setActiveId(ids[0] ?? null);
      return;
    }

    const { top, height, scrollTop, scrollHeight } = getViewportMetrics(doc, container);
    const bottomMarginPx = Math.max(0, bottomMargin) * height;

    if (bottomLock && scrollTop + height >= scrollHeight - 2 - bottomMarginPx) {
      setActiveId(elements[elements.length - 1]?.id ?? null);
      return;
    }

    const activationLine = resolveActivationLine(top, height, activation, topOffset);
    const t = Math.max(0, Math.min(1, threshold));
    let next = findLastAbove(elements, activationLine, t) ?? elements[0]?.id ?? null;

    if (next && elements.length > 1) {
      const pickedEl = doc.getElementById(next);
      if (pickedEl && pickedEl.getBoundingClientRect().bottom < top) {
        next = findLastAbove(elements, top + height * 0.5) ?? next;
      }
    }

    setActiveId(next);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: idsKey is the serialized form of ids (ids.join("\0")); depending on the array identity would re-run this effect every render, so ids.length/ids[0] reads are covered by idsKey.
  useEffect(() => {
    if (doc === null || !enabled || ids.length === 0) {
      setActiveId(null);
      return;
    }

    setActiveId(ids[0] ?? null);

    const view = doc.defaultView;
    if (!view) return;

    const container = getContainer(doc, containerId);
    const scrollTarget: EventTarget = container ?? view;
    const hasScrollEnd = "onscrollend" in doc;
    let frame = 0;

    const clearSettleTimer = (): void => {
      if (settleTimerRef.current === 0) return;
      view.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = 0;
    };

    const scheduleUpdate = (): void => {
      if (scrollingToRef.current !== null) {
        if (hasScrollEnd) {
          clearSettleTimer();
          return;
        }
        clearSettleTimer();
        settleTimerRef.current = view.setTimeout(() => {
          settleTimerRef.current = 0;
          scrollingToRef.current = null;
          setSettleSignal((n) => n + 1);
        }, settleDelay);
        return;
      }

      if (frame !== 0) return;
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    const handleScrollEnd = (): void => {
      if (scrollingToRef.current === null) return;
      clearSettleTimer();
      scrollingToRef.current = null;
      update();
    };

    scrollTarget.addEventListener("scroll", scheduleUpdate, { passive: true });
    view.addEventListener("resize", scheduleUpdate);
    if (hasScrollEnd) scrollTarget.addEventListener("scrollend", handleScrollEnd);

    let mutationObs: MutationObserver | null = null;
    if (observe && typeof view.MutationObserver === "function") {
      mutationObs = new view.MutationObserver(scheduleUpdate);
      mutationObs.observe(container ?? doc.body, { childList: true, subtree: true });
    }

    scheduleUpdate();

    return () => {
      scrollTarget.removeEventListener("scroll", scheduleUpdate);
      view.removeEventListener("resize", scheduleUpdate);
      if (hasScrollEnd) scrollTarget.removeEventListener("scrollend", handleScrollEnd);
      mutationObs?.disconnect();
      if (frame !== 0) view.cancelAnimationFrame(frame);
      clearSettleTimer();
      scrollingToRef.current = null;
    };
  }, [
    doc,
    idsKey,
    containerId,
    activation,
    topOffset,
    bottomMargin,
    threshold,
    bottomLock,
    enabled,
    settleDelay,
    observe,
  ]);

  // A settle timer releases the scroll guard and bumps this signal; recomputing
  // here keeps the Effect Event effect-owned instead of called from the timer.
  useEffect(() => {
    if (settleSignal === 0) return;
    update();
  }, [settleSignal]);

  const scrollTo = useCallback(
    (id: string) => {
      if (doc === null) return;
      const heading = doc.getElementById(id);
      if (!isOwnerHTMLElement(doc, heading)) return;

      scrollingToRef.current = id;
      setActiveId(id);

      const view = doc.defaultView;
      const container = getContainer(doc, containerId);
      const behavior = resolveScrollBehavior(view);

      if (container) {
        const containerRect = container.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const relativeTop = headingRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({ top: Math.max(0, relativeTop - scrollOffset), behavior });
      } else if (view) {
        view.scrollTo({
          top: Math.max(0, view.scrollY + heading.getBoundingClientRect().top - scrollOffset),
          behavior,
        });
      }

      // A no-movement programmatic scroll fires neither "scroll" nor "scrollend",
      // so release the guard on a settle timer to keep scroll-spy from freezing.
      if (view) {
        if (settleTimerRef.current !== 0) view.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = view.setTimeout(() => {
          settleTimerRef.current = 0;
          scrollingToRef.current = null;
          setSettleSignal((n) => n + 1);
        }, settleDelay);
      }
    },
    [doc, containerId, scrollOffset, settleDelay],
  );

  return { activeId, scrollTo };
}
