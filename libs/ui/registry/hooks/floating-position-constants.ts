export type FloatingSide = "top" | "bottom" | "left" | "right";
export type FloatingAlign = "start" | "center" | "end";
export type FloatingPlacement = `${FloatingSide}` | `${FloatingSide}-${FloatingAlign}`;

export interface Viewport {
  width: number;
  height: number;
}

// Placement flip target when collision avoidance fires; duplicates floating-panel's
// CSS-edge map by data but the intent is the resolved opposite placement, not a CSS edge.
export const OPPOSITE_SIDE: Record<FloatingSide, FloatingSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

export const CROSS_AXIS_SIDES: Record<FloatingSide, [FloatingSide, FloatingSide]> = {
  top: ["left", "right"],
  bottom: ["left", "right"],
  left: ["top", "bottom"],
  right: ["top", "bottom"],
};
