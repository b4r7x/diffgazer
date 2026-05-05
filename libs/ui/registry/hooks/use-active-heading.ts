"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

export type ActiveHeadingActivation = "top-line" | "viewport-center" | (number & {});

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
}

export interface UseActiveHeadingReturn {
  activeId: string | null;
  scrollTo: (id: string) => void;
}

function getContainer(id: string | undefined): HTMLElement | null {
  if (!id) return null;
  const el = document.getElementById(id);
  return el instanceof HTMLElement ? el : null;
}

function getViewportMetrics(container: HTMLElement | null) {
  if (container) {
    return {
      top: container.getBoundingClientRect().top,
      height: container.clientHeight,
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
    };
  }

  const root = document.documentElement;
  const body = document.body;
  const scrollTop = window.scrollY || root.scrollTop || body?.scrollTop || 0;
  const scrollHeight = Math.max(root.scrollHeight, body?.scrollHeight ?? 0);

  return {
    top: 0,
    height: window.innerHeight,
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

function resolveScrollBehavior(): ScrollBehavior {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
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
}: UseActiveHeadingOptions): UseActiveHeadingReturn {
  const idsKey = ids.join("\0");
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const scrollingToRef = useRef<string | null>(null);
  const settleTimerRef = useRef<number>(0);

  const update = useEffectEvent((): void => {
    if (scrollingToRef.current !== null) return;

    const container = getContainer(containerId);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el instanceof HTMLElement);

    if (elements.length === 0) {
      setActiveId(ids[0] ?? null);
      return;
    }

    const { top, height, scrollTop, scrollHeight } = getViewportMetrics(container);
    const bottomMarginPx = Math.max(0, bottomMargin) * height;

    if (bottomLock && scrollTop + height >= scrollHeight - 2 - bottomMarginPx) {
      setActiveId(elements[elements.length - 1]?.id ?? null);
      return;
    }

    const activationLine = resolveActivationLine(top, height, activation, topOffset);
    const t = Math.max(0, Math.min(1, threshold));
    let next = findLastAbove(elements, activationLine, t) ?? elements[0]?.id ?? null;

    if (next && elements.length > 1) {
      const pickedEl = document.getElementById(next);
      if (pickedEl && pickedEl.getBoundingClientRect().bottom < top) {
        next = findLastAbove(elements, top + height * 0.5) ?? next;
      }
    }

    setActiveId(next);
  });

  useEffect(() => {
    if (!enabled || ids.length === 0) {
      setActiveId(null);
      return;
    }

    setActiveId(ids[0] ?? null);

    const container = getContainer(containerId);
    const scrollTarget: EventTarget = container ?? window;
    const hasScrollEnd = "onscrollend" in window;
    let frame = 0;

    const scheduleUpdate = (): void => {
      if (scrollingToRef.current !== null) {
        if (!hasScrollEnd) {
          if (settleTimerRef.current !== 0) window.clearTimeout(settleTimerRef.current);
          settleTimerRef.current = window.setTimeout(() => {
            settleTimerRef.current = 0;
            scrollingToRef.current = null;
            update();
          }, settleDelay);
        }
        return;
      }

      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
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
    window.addEventListener("resize", scheduleUpdate);
    if (hasScrollEnd) scrollTarget.addEventListener("scrollend", handleScrollEnd);

    let mutationObs: MutationObserver | null = null;
    if (observe) {
      mutationObs = new MutationObserver(scheduleUpdate);
      mutationObs.observe(container ?? document.body, { childList: true, subtree: true });
    }

    scheduleUpdate();

    return () => {
      scrollTarget.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (hasScrollEnd) scrollTarget.removeEventListener("scrollend", handleScrollEnd);
      mutationObs?.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
      if (settleTimerRef.current !== 0) window.clearTimeout(settleTimerRef.current);
    };
  }, [idsKey, containerId, enabled, settleDelay, observe]);

  const scrollTo = useEffectEvent((id: string) => {
    const heading = document.getElementById(id);
    if (!(heading instanceof HTMLElement)) return;

    scrollingToRef.current = id;
    setActiveId(id);

    const container = getContainer(containerId);
    const behavior = resolveScrollBehavior();

    if (container) {
      const containerRect = container.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const relativeTop = headingRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: Math.max(0, relativeTop - scrollOffset), behavior });
    } else {
      window.scrollTo({
        top: Math.max(0, window.scrollY + heading.getBoundingClientRect().top - scrollOffset),
        behavior,
      });
    }
  });

  return { activeId, scrollTo };
}
