/** Side of the trigger used as the floating-content anchor. */
export type FloatingSide = "top" | "bottom" | "left" | "right";
/** Cross-axis alignment relative to the trigger. */
export type FloatingAlign = "start" | "center" | "end";
/** Placement token combining side and optional alignment. */
export type FloatingPlacement = `${FloatingSide}` | `${FloatingSide}-${FloatingAlign}`;

/** Viewport dimensions used by floating-position collision math. */
export interface Viewport {
  /** Viewport width in CSS pixels. */
  width: number;
  /** Viewport height in CSS pixels. */
  height: number;
}

// Placement flip target when collision avoidance fires; duplicates floating-panel's
// CSS-edge map by data but the intent is the resolved opposite placement, not a CSS edge.
/** Opposite side used as the first collision fallback. */
export const OPPOSITE_SIDE: Record<FloatingSide, FloatingSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/** Cross-axis fallback sides used after preferred and opposite side checks. */
export const CROSS_AXIS_SIDES: Record<FloatingSide, [FloatingSide, FloatingSide]> = {
  top: ["left", "right"],
  bottom: ["left", "right"],
  left: ["top", "bottom"],
  right: ["top", "bottom"],
};
