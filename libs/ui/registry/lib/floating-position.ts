import {
  type Bounds,
  CROSS_AXIS_SIDES,
  type FloatingAlign,
  type FloatingSide,
  OPPOSITE_SIDE,
  type Viewport,
} from "./floating-position-constants";

/**
 * Returns true when the anchor box lies entirely past one edge of the clipping bounds.
 *
 * Collision avoidance clamps floating content into the viewport, so once the anchor
 * scrolls out of its clipping region the panel would otherwise park itself against a
 * viewport edge, detached from the element it belongs to. Callers use this to suppress
 * the panel instead.
 */
export function isAnchorClippedOut(anchor: Bounds, bounds: Bounds): boolean {
  return (
    anchor.bottom <= bounds.top ||
    anchor.top >= bounds.bottom ||
    anchor.right <= bounds.left ||
    anchor.left >= bounds.right
  );
}

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

/**
 * Room inside the padded viewport, ignoring the trigger.
 *
 * Used when no placement fits: the panel is going to be clamped into the padded viewport by
 * `shift()` anyway, so the padded viewport — not the room at the trigger edge, which can be
 * ~0 on a short viewport — is the size it actually has.
 */
export function computeViewportAvailableSize(
  collisionPadding: number,
  vp: Viewport,
): { availableHeight: number; availableWidth: number } {
  return {
    availableHeight: Math.max(0, vp.height - 2 * collisionPadding),
    availableWidth: Math.max(0, vp.width - 2 * collisionPadding),
  };
}

/**
 * Picks the first placement that fits, trying preferred, opposite, then cross-axis sides.
 *
 * When nothing fits it falls back to the best-fitting candidate instead of the preferred one and
 * reports `fitted: false`, so the caller can cap the panel against the viewport rather than
 * against a side that leaves no room.
 */
export function resolveCollisionPosition(
  triggerRect: DOMRect,
  contentRect: DOMRect,
  preferredSide: FloatingSide,
  preferredAlign: FloatingAlign,
  sideOffset: number,
  alignOffset: number,
  collisionPadding: number,
  vp: Viewport,
): { x: number; y: number; side: FloatingSide; fitted: boolean } {
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
    if (!wouldOverflowOnPlacementAxis(pos.x, pos.y, contentRect, collisionPadding, vp, side)) {
      return { ...pos, side, fitted: true };
    }
  }

  // Nothing fits. Rank by overflow on each candidate's own placement axis rather than by raw
  // room: raw room would compare a height against a width, while overflow is measured against
  // the panel's own extent on that axis and is therefore comparable. Floored at 0 so sides that
  // are large enough and failed only on position — which shift() resolves — all tie, and strict
  // `<` keeps candidate order on a tie, so the preferred side wins one.
  let bestSide = preferredSide;
  let bestOverflow = Number.POSITIVE_INFINITY;
  for (const side of candidates) {
    const { availableHeight, availableWidth } = computeAvailableSize(
      triggerRect,
      side,
      sideOffset,
      collisionPadding,
      vp,
    );
    const overflow = Math.max(
      0,
      side === "top" || side === "bottom"
        ? contentRect.height - availableHeight
        : contentRect.width - availableWidth,
    );
    if (overflow < bestOverflow) {
      bestOverflow = overflow;
      bestSide = side;
    }
  }

  const fallback = computePosition(
    triggerRect,
    contentRect,
    bestSide,
    preferredAlign,
    sideOffset,
    alignOffset,
  );
  return { ...fallback, side: bestSide, fitted: false };
}

function wouldOverflowOnPlacementAxis(
  x: number,
  y: number,
  contentRect: DOMRect,
  padding: number,
  vp: Viewport,
  side: FloatingSide,
): boolean {
  if (side === "top" || side === "bottom") {
    return y < padding || y + contentRect.height > vp.height - padding;
  }
  return x < padding || x + contentRect.width > vp.width - padding;
}
