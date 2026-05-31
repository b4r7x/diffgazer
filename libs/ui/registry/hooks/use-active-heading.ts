"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

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
  ids: string[];
  containerId?: string;
  /** @default "top-line" */
  activation?: ActiveHeadingActivation;
  topOffset?: number;
  scrollOffset?: number;
  bottomMargin?: number;
  threshold?: number;
  bottomLock?: boolean;
  enabled?: boolean;
  settleDelay?: number;
  /** Watch for DOM changes via MutationObserver. Disable for static content. @default true */
  observe?: boolean;
  /** Document to resolve headings and viewport metrics against. @default the ambient `document` */
  ownerDocument?: Document;
}

export interface UseActiveHeadingReturn {
  activeId: string | null;
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
    const rect = elements[i]!.getBoundingClientRect();
    if (rect.top + rect.height * thresholdRatio <= line) return elements[i]!.id;
  }
  return null;
}

function resolveScrollBehavior(view: (Window & typeof globalThis) | null): ScrollBehavior {
  return view && typeof view.matchMedia === "function" &&
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
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
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

    const scheduleUpdate = (): void => {
      if (scrollingToRef.current !== null) {
        if (!hasScrollEnd) {
          if (settleTimerRef.current !== 0) view.clearTimeout(settleTimerRef.current);
          settleTimerRef.current = view.setTimeout(() => {
            settleTimerRef.current = 0;
            scrollingToRef.current = null;
            update();
          }, settleDelay);
        }
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
      if (settleTimerRef.current !== 0) view.clearTimeout(settleTimerRef.current);
    };
  }, [doc, idsKey, containerId, activation, topOffset, bottomMargin, threshold, bottomLock, enabled, settleDelay, observe]);

  const scrollTo = useCallback((id: string) => {
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
  }, [doc, containerId, scrollOffset]);

  return { activeId, scrollTo };
}
