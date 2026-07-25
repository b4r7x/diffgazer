"use client";

import {
  type RefCallback,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  computeAvailableSize,
  computePosition,
  isAnchorClippedOut,
  resolveCollisionPosition,
  shift,
  wouldOverflow,
} from "@/lib/floating-position";
import type {
  Bounds,
  FloatingAlign,
  FloatingPlacement,
  FloatingSide,
  Viewport,
} from "@/lib/floating-position-constants";

export { computePosition, isAnchorClippedOut, resolveCollisionPosition, shift, wouldOverflow };
export type { FloatingAlign, FloatingPlacement, FloatingSide };

/** Options for positioning floating content relative to a trigger element. */
export interface UseFloatingPositionOptions {
  /** Ref to the trigger element that the floating content is positioned relative to. */
  triggerRef: RefObject<HTMLElement | null>;
  /** Whether the floating content is open. Position is computed when true and reset to null when false. */
  open: boolean;
  /** Preferred side for positioning. Auto-flips if there is not enough space. @default "top" */
  side?: FloatingSide;
  /** Alignment along the cross axis. @default "center" */
  align?: FloatingAlign;
  /** Distance in pixels between the trigger and floating content along the side axis. @default 6 */
  sideOffset?: number;
  /** Offset in pixels along the alignment axis. @default 0 */
  alignOffset?: number;
  /** Minimum distance in pixels from viewport edges when avoiding collisions. @default 8 */
  collisionPadding?: number;
  /** Whether to automatically flip sides and shift position to stay within viewport. @default true */
  avoidCollisions?: boolean;
}

/** Computed floating-content geometry for the current layout pass. */
export interface FloatingPosition {
  /** Viewport-relative x coordinate. */
  x: number;
  /** Viewport-relative y coordinate. */
  y: number;
  /** Resolved side after collision handling. */
  side: FloatingSide;
  /** Alignment used along the cross axis. */
  align: FloatingAlign;
  /** Current trigger element width. */
  triggerWidth: number;
  /** Available height along the resolved side after collision padding. */
  availableHeight: number;
  /** Available width along the resolved side after collision padding. */
  availableWidth: number;
  /**
   * True while the trigger has scrolled fully out of the viewport or out of one of its
   * scroll ancestors. Panels should suppress themselves instead of showing the clamped
   * position, which is no longer attached to anything.
   */
  anchorHidden: boolean;
}

/** Computed position plus the ref that must be attached to the floating content element. */
export interface UseFloatingPositionReturn {
  /** Computed position with x/y coordinates and resolved side. Null when closed. */
  position: FloatingPosition | null;
  /** Callback ref to attach to the floating content element so attachment changes are observed. */
  contentRef: RefCallback<HTMLDivElement>;
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
    /auto|scroll|overlay|hidden|clip/.test(
      (overflow ?? "") + (overflowY ?? "") + (overflowX ?? ""),
    ) &&
    display !== "inline" &&
    display !== "contents"
  );
}

function getNearestOverflowAncestor(node: Node): HTMLElement | null {
  const parent = getParentNode(node);
  if (isLastTraversableNode(parent)) {
    return node.ownerDocument?.body ?? null;
  }
  const HTMLElementCtor = parent.ownerDocument?.defaultView?.HTMLElement;
  if (HTMLElementCtor && parent instanceof HTMLElementCtor && isOverflowElement(parent)) {
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

// A trigger with no measurable box has not been laid out (or is display:none in a
// synthetic environment); its rect cannot distinguish "scrolled away" from "not measured
// yet", so it is never treated as clipped. Clip regions reported as zero-area are skipped
// for the same reason.
function isAnchorHidden(triggerRect: DOMRect, clipAncestors: readonly Element[], vp: Viewport) {
  if (triggerRect.width === 0 && triggerRect.height === 0) return false;

  const viewportBounds: Bounds = { top: 0, left: 0, right: vp.width, bottom: vp.height };
  if (isAnchorClippedOut(triggerRect, viewportBounds)) return true;

  for (const ancestor of clipAncestors) {
    const clipRect = ancestor.getBoundingClientRect();
    if (clipRect.width === 0 || clipRect.height === 0) continue;
    if (isAnchorClippedOut(triggerRect, clipRect)) return true;
  }

  return false;
}

/** Position floating content relative to a trigger element. */
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
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const contentRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
    setContent(node);
  }, []);
  const frameRef = useRef<number | null>(null);
  // Populated by the open effect, which already walks these ancestors to subscribe to
  // their scroll events; reused here so anchor-visibility checks stay O(ancestors) per
  // frame instead of re-walking the DOM.
  const clipAncestorsRef = useRef<readonly Element[]>([]);

  // Ref-to-state promotion with equality bail; must observe every render.
  useLayoutEffect(() => {
    const nextTrigger = triggerRef.current;
    if (nextTrigger !== trigger) setTrigger(nextTrigger);
  });

  const update = useCallback(() => {
    if (!trigger || !content) return;

    const view = trigger.ownerDocument?.defaultView ?? window;
    const triggerRect = trigger.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const vp: Viewport = { width: view.innerWidth, height: view.innerHeight };

    const {
      x: resolvedX,
      y: resolvedY,
      side: finalSide,
    } = avoidCollisions
      ? resolveCollisionPosition(
          triggerRect,
          contentRect,
          preferredSide,
          preferredAlign,
          sideOffset,
          alignOffset,
          collisionPadding,
          vp,
        )
      : {
          ...computePosition(
            triggerRect,
            contentRect,
            preferredSide,
            preferredAlign,
            sideOffset,
            alignOffset,
          ),
          side: preferredSide,
        };

    const pos = avoidCollisions
      ? shift(resolvedX, resolvedY, contentRect, collisionPadding, vp)
      : { x: resolvedX, y: resolvedY };

    const { availableHeight, availableWidth } = computeAvailableSize(
      triggerRect,
      finalSide,
      sideOffset,
      collisionPadding,
      vp,
    );

    setPosition({
      x: pos.x,
      y: pos.y,
      side: finalSide,
      align: preferredAlign,
      triggerWidth: triggerRect.width,
      availableHeight,
      availableWidth,
      anchorHidden: isAnchorHidden(triggerRect, clipAncestorsRef.current, vp),
    });
  }, [
    alignOffset,
    avoidCollisions,
    collisionPadding,
    preferredAlign,
    preferredSide,
    sideOffset,
    trigger,
    content,
  ]);

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

    if (!trigger || !content) {
      setPosition(null);
      return;
    }

    // Discovered before the first measurement so the anchor-visibility check inside
    // update() sees the same clip regions the scroll subscriptions below use.
    const scrollParents = getOverflowAncestors(trigger);
    clipAncestorsRef.current = scrollParents;

    update();

    const view = trigger.ownerDocument?.defaultView ?? window;
    let active = true;
    const handleLayoutChange = () => {
      if (active) scheduleUpdate();
    };
    const ResizeObserverCtor = view.ResizeObserver;
    const observer =
      typeof ResizeObserverCtor === "function" ? new ResizeObserverCtor(handleLayoutChange) : null;
    observer?.observe(trigger);
    observer?.observe(content);

    for (const parent of scrollParents) {
      parent.addEventListener("scroll", handleLayoutChange, { passive: true });
    }
    view.addEventListener("scroll", handleLayoutChange, { passive: true });
    view.addEventListener("resize", handleLayoutChange);

    return () => {
      active = false;
      clipAncestorsRef.current = [];
      observer?.disconnect();
      for (const parent of scrollParents) {
        parent.removeEventListener("scroll", handleLayoutChange);
      }
      view.removeEventListener("scroll", handleLayoutChange);
      view.removeEventListener("resize", handleLayoutChange);
      if (frameRef.current != null) {
        view.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [content, open, trigger, update, scheduleUpdate]);

  return { position, contentRef };
}
