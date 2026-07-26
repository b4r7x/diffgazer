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
  computeViewportAvailableSize,
  isAnchorClippedOut,
  resolveCollisionPosition,
  shift,
  wouldOverflow,
} from "@/lib/floating-position";
import type {
  Bounds,
  FloatingAlign,
  FloatingSide,
  Viewport,
} from "@/lib/floating-position-constants";

export {
  computePosition,
  computeViewportAvailableSize,
  isAnchorClippedOut,
  resolveCollisionPosition,
  shift,
  wouldOverflow,
};
export type { FloatingAlign, FloatingSide };

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

// An ancestor establishes a containing block for fixed-position descendants when
// any of these properties leave their initial value (CSS spec: transforms,
// perspective, filters, will-change on those, layout/paint containment).
function isContainingBlockForFixed(element: Element): boolean {
  const view = element.ownerDocument?.defaultView ?? window;
  // A property the engine does not implement is simply absent from the declaration, and an
  // absent property must read as its initial value: comparing `undefined` against "none"
  // succeeds and would report every ancestor as a containing block. Normalizing once means a
  // reader does not have to know which of these properties the browser baseline happens to
  // expose (backdrop-filter and content-visibility are the two that can be missing in the
  // supported Safari range) to see that the function is safe.
  const cs = view.getComputedStyle(element) as unknown as Record<string, string | undefined>;
  const changed = (property: string, initial = "none") => {
    const value = cs[property] ?? initial;
    return value !== initial && value !== "";
  };
  return (
    changed("transform") ||
    changed("translate") ||
    changed("scale") ||
    changed("rotate") ||
    changed("perspective") ||
    changed("filter") ||
    changed("backdropFilter") ||
    changed("contentVisibility", "visible") ||
    /transform|translate|scale|rotate|perspective|filter/.test(cs.willChange ?? "") ||
    /paint|layout|strict|content/.test(cs.contain ?? "")
  );
}

// Walks up from the trigger collecting only ancestors whose overflow can
// actually clip it: a fixed subject escapes everything except its fixed
// containing block; an absolute subject escapes static, non-containing-block
// ancestors; normal-flow subjects are clipped by every overflow ancestor.
// After passing a positioned escape's containing block, clipping continues
// with that ancestor's own positioning mode.
function getClipAncestors(trigger: HTMLElement): Element[] {
  const view = trigger.ownerDocument?.defaultView ?? window;
  const toEscape = (position: string): "none" | "absolute" | "fixed" => {
    if (position === "fixed") return "fixed";
    if (position === "absolute") return "absolute";
    return "none";
  };
  let escapeMode = toEscape(view.getComputedStyle(trigger).position);
  const clip: Element[] = [];
  let node: Node = trigger;
  while (true) {
    const parent = getParentNode(node);
    if (parent === node || isLastTraversableNode(parent)) break;
    node = parent;
    const HTMLElementCtor = parent.ownerDocument?.defaultView?.HTMLElement;
    if (!HTMLElementCtor || !(parent instanceof HTMLElementCtor)) continue;
    const cs = view.getComputedStyle(parent);
    const cbForFixed = isContainingBlockForFixed(parent);
    const positioned = cs.position !== "static";
    let clips: boolean;
    if (escapeMode === "none") {
      clips = true;
    } else if (escapeMode === "absolute") {
      clips = positioned || cbForFixed;
    } else {
      clips = cbForFixed;
    }
    if (clips && isOverflowElement(parent)) clip.push(parent);
    if (escapeMode === "none" || clips) escapeMode = toEscape(cs.position);
  }
  return clip;
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
  // Populated by the open effect with the subset of overflow ancestors that can actually
  // clip the trigger (see getClipAncestors); cached here so anchor-visibility checks stay
  // O(ancestors) per frame instead of re-walking the DOM.
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
      fitted,
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
          fitted: true,
        };

    const pos = avoidCollisions
      ? shift(resolvedX, resolvedY, contentRect, collisionPadding, vp)
      : { x: resolvedX, y: resolvedY };

    // A side that fits leaves at least the panel's own measured extent on its placement axis, so
    // the cap can never be 0 there; when nothing fits, `shift()` clamps the panel into the padded
    // viewport, which is then the room it really has. Between the two the zero-height case is
    // unreachable, which is why there is no hard-coded floor. The pairing is also stable: capping
    // a panel can only turn a non-fitting side into a fitting one, and the newly computed side
    // room is then at least the capped size, so the caps do not oscillate.
    const { availableHeight, availableWidth } = fitted
      ? computeAvailableSize(triggerRect, finalSide, sideOffset, collisionPadding, vp)
      : computeViewportAvailableSize(collisionPadding, vp);

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
    // update() already sees its clip regions. Scroll subscriptions stay on the FULL
    // overflow-ancestor list (any of them can move the trigger), while the clip check
    // only gets the ancestors that can actually clip it given its positioning mode.
    const scrollParents = getOverflowAncestors(trigger);
    clipAncestorsRef.current = getClipAncestors(trigger);

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
