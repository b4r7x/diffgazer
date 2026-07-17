import {
  CROSS_AXIS_SIDES,
  type FloatingAlign,
  type FloatingSide,
  OPPOSITE_SIDE,
  type Viewport,
} from "./floating-position-constants";

/** Computes viewport coordinates for floating content from trigger/content rectangles. */
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

/** Returns true when a content rectangle at x/y would cross the padded viewport bounds. */
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

/** Clamps floating coordinates inside the padded viewport bounds. */
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

/**
 * Computes the max content size available from the trigger edge to the viewport edge.
 *
 * Panels use this to cap height or width and scroll internally instead of overflowing.
 */
export function computeAvailableSize(
  triggerRect: DOMRect,
  side: FloatingSide,
  sideOffset: number,
  collisionPadding: number,
  vp: Viewport,
): { availableHeight: number; availableWidth: number } {
  let availableHeight: number;
  let availableWidth: number;

  switch (side) {
    case "top":
      availableHeight = triggerRect.top - sideOffset - collisionPadding;
      availableWidth = vp.width - 2 * collisionPadding;
      break;
    case "bottom":
      availableHeight = vp.height - triggerRect.bottom - sideOffset - collisionPadding;
      availableWidth = vp.width - 2 * collisionPadding;
      break;
    case "left":
      availableWidth = triggerRect.left - sideOffset - collisionPadding;
      availableHeight = vp.height - 2 * collisionPadding;
      break;
    case "right":
      availableWidth = vp.width - triggerRect.right - sideOffset - collisionPadding;
      availableHeight = vp.height - 2 * collisionPadding;
      break;
  }

  return {
    availableHeight: Math.max(0, availableHeight),
    availableWidth: Math.max(0, availableWidth),
  };
}

/** Picks the first placement that fits, trying preferred, opposite, then cross-axis sides. */
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
    const pos = computePosition(
      triggerRect,
      contentRect,
      side,
      preferredAlign,
      sideOffset,
      alignOffset,
    );
    if (!wouldOverflow(pos.x, pos.y, contentRect, collisionPadding, vp)) {
      return { ...pos, side };
    }
  }

  const fallback = computePosition(
    triggerRect,
    contentRect,
    preferredSide,
    preferredAlign,
    sideOffset,
    alignOffset,
  );
  return { ...fallback, side: preferredSide };
}
