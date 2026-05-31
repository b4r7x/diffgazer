import {
  CROSS_AXIS_SIDES,
  OPPOSITE_SIDE,
  type FloatingAlign,
  type FloatingSide,
  type Viewport,
} from "./floating-position-constants";

function computePositionFrom(options: {
  triggerRect: DOMRect;
  contentRect: DOMRect;
  side: FloatingSide;
  align: FloatingAlign;
  sideOffset: number;
  alignOffset: number;
}): { x: number; y: number } {
  const { triggerRect, contentRect, side, align, sideOffset, alignOffset } = options;
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

function wouldOverflowFrom(options: {
  x: number;
  y: number;
  contentRect: DOMRect;
  padding: number;
  vp: Viewport;
}): boolean {
  const { x, y, contentRect, padding, vp } = options;
  return (
    x < padding ||
    y < padding ||
    x + contentRect.width > vp.width - padding ||
    y + contentRect.height > vp.height - padding
  );
}

function shiftFrom(options: {
  x: number;
  y: number;
  contentRect: DOMRect;
  padding: number;
  vp: Viewport;
}): { x: number; y: number } {
  const { x, y, contentRect, padding, vp } = options;
  return {
    x: Math.max(padding, Math.min(x, vp.width - contentRect.width - padding)),
    y: Math.max(padding, Math.min(y, vp.height - contentRect.height - padding)),
  };
}

function resolveCollisionPositionFrom(options: {
  triggerRect: DOMRect;
  contentRect: DOMRect;
  preferredSide: FloatingSide;
  preferredAlign: FloatingAlign;
  sideOffset: number;
  alignOffset: number;
  collisionPadding: number;
  vp: Viewport;
}): { x: number; y: number; side: FloatingSide } {
  const { triggerRect, contentRect, preferredSide, preferredAlign, sideOffset, alignOffset, collisionPadding, vp } =
    options;
  const candidates: FloatingSide[] = [
    preferredSide,
    OPPOSITE_SIDE[preferredSide],
    ...CROSS_AXIS_SIDES[preferredSide],
  ];

  for (const side of candidates) {
    const pos = computePositionFrom({ triggerRect, contentRect, side, align: preferredAlign, sideOffset, alignOffset });
    if (!wouldOverflowFrom({ x: pos.x, y: pos.y, contentRect, padding: collisionPadding, vp })) {
      return { ...pos, side };
    }
  }

  const fallback = computePositionFrom({
    triggerRect,
    contentRect,
    side: preferredSide,
    align: preferredAlign,
    sideOffset,
    alignOffset,
  });
  return { ...fallback, side: preferredSide };
}

// Public helpers keep the positional call shape so existing copy/package consumers
// (including plain JS) keep working. The object-form internals above are used by
// callers that benefit from named arguments.
export function computePosition(
  triggerRect: DOMRect,
  contentRect: DOMRect,
  side: FloatingSide,
  align: FloatingAlign,
  sideOffset: number,
  alignOffset: number,
): { x: number; y: number } {
  return computePositionFrom({ triggerRect, contentRect, side, align, sideOffset, alignOffset });
}

export function wouldOverflow(
  x: number,
  y: number,
  contentRect: DOMRect,
  padding: number,
  vp: Viewport,
): boolean {
  return wouldOverflowFrom({ x, y, contentRect, padding, vp });
}

export function shift(
  x: number,
  y: number,
  contentRect: DOMRect,
  padding: number,
  vp: Viewport,
): { x: number; y: number } {
  return shiftFrom({ x, y, contentRect, padding, vp });
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
  return resolveCollisionPositionFrom({
    triggerRect,
    contentRect,
    preferredSide,
    preferredAlign,
    sideOffset,
    alignOffset,
    collisionPadding,
    vp,
  });
}
