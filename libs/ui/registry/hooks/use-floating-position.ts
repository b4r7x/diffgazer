"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type FloatingSide = "top" | "bottom" | "left" | "right";
export type FloatingAlign = "start" | "center" | "end";
export type FloatingPlacement = `${FloatingSide}` | `${FloatingSide}-${FloatingAlign}`;

export interface UseFloatingPositionOptions {
  triggerRef: RefObject<HTMLElement | null>;
  open: boolean;
  side?: FloatingSide;
  align?: FloatingAlign;
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  avoidCollisions?: boolean;
}

export interface FloatingPosition {
  x: number;
  y: number;
  side: FloatingSide;
  align: FloatingAlign;
}

export interface UseFloatingPositionReturn {
  position: FloatingPosition | null;
  contentRef: RefObject<HTMLDivElement | null>;
}

const OPPOSITE_SIDE: Record<FloatingSide, FloatingSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const CROSS_AXIS_SIDES: Record<FloatingSide, [FloatingSide, FloatingSide]> = {
  top: ["left", "right"],
  bottom: ["left", "right"],
  left: ["top", "bottom"],
  right: ["top", "bottom"],
};

interface Viewport { width: number; height: number }

export function computePosition(
  triggerRect: DOMRect,
  contentRect: DOMRect,
  side: FloatingSide,
  align: FloatingAlign,
  sideOffset: number,
  alignOffset: number,
): { x: number; y: number } {
  let x = 0;
  let y = 0;

  switch (side) {
    case "top":
      y = triggerRect.top - contentRect.height - sideOffset;
      break;
    case "bottom":
      y = triggerRect.bottom + sideOffset;
      break;
    case "left":
      x = triggerRect.left - contentRect.width - sideOffset;
      break;
    case "right":
      x = triggerRect.right + sideOffset;
      break;
  }

  const isVertical = side === "top" || side === "bottom";

  if (isVertical) {
    switch (align) {
      case "start":
        x = triggerRect.left + alignOffset;
        break;
      case "center":
        x = triggerRect.left + triggerRect.width / 2 - contentRect.width / 2 + alignOffset;
        break;
      case "end":
        x = triggerRect.right - contentRect.width - alignOffset;
        break;
    }
  } else {
    switch (align) {
      case "start":
        y = triggerRect.top + alignOffset;
        break;
      case "center":
        y = triggerRect.top + triggerRect.height / 2 - contentRect.height / 2 + alignOffset;
        break;
      case "end":
        y = triggerRect.bottom - contentRect.height - alignOffset;
        break;
    }
  }

  return { x, y };
}

export function wouldOverflow(
  x: number,
  y: number,
  contentRect: DOMRect,
  padding: number,
  vp: Viewport,
): boolean {
  return (
    x < padding ||
    y < padding ||
    x + contentRect.width > vp.width - padding ||
    y + contentRect.height > vp.height - padding
  );
}

export function shift(
  x: number,
  y: number,
  contentRect: DOMRect,
  padding: number,
  vp: Viewport,
): { x: number; y: number } {
  return {
    x: Math.max(padding, Math.min(x, vp.width - contentRect.width - padding)),
    y: Math.max(padding, Math.min(y, vp.height - contentRect.height - padding)),
  };
}

export function resolveCollisionPosition(
  triggerRect: DOMRect,
  contentRect: DOMRect,
  preferredSide: FloatingSide,
  preferredAlign: FloatingAlign,
  sideOffset: number,
  alignOffset: number,
  collisionPadding: number,
  vp: Viewport,
): { x: number; y: number; side: FloatingSide } {
  const candidates: FloatingSide[] = [
    preferredSide,
    OPPOSITE_SIDE[preferredSide],
    ...CROSS_AXIS_SIDES[preferredSide],
  ];

  for (const side of candidates) {
    const pos = computePosition(triggerRect, contentRect, side, preferredAlign, sideOffset, alignOffset);
    if (!wouldOverflow(pos.x, pos.y, contentRect, collisionPadding, vp)) {
      return { ...pos, side };
    }
  }

  const fallback = computePosition(triggerRect, contentRect, preferredSide, preferredAlign, sideOffset, alignOffset);
  return { ...fallback, side: preferredSide };
}

function getNodeName(node: Node): string {
  return (node.nodeName || "").toLowerCase();
}

function isLastTraversableNode(node: Node): boolean {
  return /^(html|body|#document)$/.test(getNodeName(node));
}

function isShadowRoot(value: Node): value is ShadowRoot {
  const view = value.ownerDocument?.defaultView;
  if (!view || typeof view.ShadowRoot === "undefined") return false;
  return value instanceof view.ShadowRoot;
}

function getParentNode(node: Node): Node {
  if (getNodeName(node) === "html") return node;
  const slotted = (node as Element & { assignedSlot?: Element }).assignedSlot;
  const result =
    slotted ??
    node.parentNode ??
    (isShadowRoot(node) ? node.host : null) ??
    node.ownerDocument?.documentElement;
  if (!result) return node;
  return isShadowRoot(result) ? result.host : result;
}

function isOverflowElement(element: Element): boolean {
  const view = element.ownerDocument?.defaultView ?? window;
  const { overflow, overflowX, overflowY, display } = view.getComputedStyle(element);
  return (
    /auto|scroll|overlay|hidden|clip/.test((overflow ?? "") + (overflowY ?? "") + (overflowX ?? "")) &&
    display !== "inline" &&
    display !== "contents"
  );
}

function getNearestOverflowAncestor(node: Node): HTMLElement | null {
  const parent = getParentNode(node);
  if (isLastTraversableNode(parent)) {
    return node.ownerDocument?.body ?? null;
  }
  if (parent instanceof HTMLElement && isOverflowElement(parent)) {
    return parent;
  }
  return getNearestOverflowAncestor(parent);
}

// Walks ancestors collecting scrollable elements. Stops at iframe/document boundaries
// (does not cross into parent frames) and pierces shadow roots via host.
function getOverflowAncestors(node: Node): Element[] {
  const ancestor = getNearestOverflowAncestor(node);
  if (!ancestor) return [];
  const isBody = ancestor === node.ownerDocument?.body;
  if (isBody) {
    return isOverflowElement(ancestor) ? [ancestor] : [];
  }
  return [ancestor, ...getOverflowAncestors(ancestor)];
}

export function useFloatingPosition({
  triggerRef,
  open,
  side: preferredSide = "top",
  align: preferredAlign = "center",
  sideOffset = 6,
  alignOffset = 0,
  collisionPadding = 8,
  avoidCollisions = true,
}: UseFloatingPositionOptions): UseFloatingPositionReturn {
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const view = trigger.ownerDocument?.defaultView ?? window;
    const triggerRect = trigger.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const vp: Viewport = { width: view.innerWidth, height: view.innerHeight };

    const { x: resolvedX, y: resolvedY, side: finalSide } = avoidCollisions
      ? resolveCollisionPosition(triggerRect, contentRect, preferredSide, preferredAlign, sideOffset, alignOffset, collisionPadding, vp)
      : { ...computePosition(triggerRect, contentRect, preferredSide, preferredAlign, sideOffset, alignOffset), side: preferredSide };

    const pos = avoidCollisions
      ? shift(resolvedX, resolvedY, contentRect, collisionPadding, vp)
      : { x: resolvedX, y: resolvedY };

    setPosition({ x: pos.x, y: pos.y, side: finalSide, align: preferredAlign });
  }, [alignOffset, avoidCollisions, collisionPadding, preferredAlign, preferredSide, sideOffset, triggerRef]);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current != null) return;
    const view = triggerRef.current?.ownerDocument?.defaultView ?? window;
    frameRef.current = view.requestAnimationFrame(() => {
      frameRef.current = null;
      update();
    });
  }, [update, triggerRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    update();

    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const ResizeObserverCtor = globalThis.ResizeObserver;
    const observer = typeof ResizeObserverCtor === "function" ? new ResizeObserverCtor(scheduleUpdate) : null;
    observer?.observe(trigger);
    observer?.observe(content);

    const scrollParents = getOverflowAncestors(trigger);
    for (const parent of scrollParents) {
      parent.addEventListener("scroll", scheduleUpdate, { passive: true });
    }
    const view = trigger.ownerDocument?.defaultView ?? window;
    view.addEventListener("scroll", scheduleUpdate, { passive: true });
    view.addEventListener("resize", scheduleUpdate);

    return () => {
      observer?.disconnect();
      for (const parent of scrollParents) {
        parent.removeEventListener("scroll", scheduleUpdate);
      }
      view.removeEventListener("scroll", scheduleUpdate);
      view.removeEventListener("resize", scheduleUpdate);
      if (frameRef.current != null) {
        view.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [open, triggerRef, update, scheduleUpdate]);

  return { position, contentRef };
}
