export type VerticalDirection = "up" | "down";
export type BoundaryDirection = "previous" | "next";

export function getVerticalArrowDirection(key: string): VerticalDirection | null {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  return null;
}

export function toVerticalBoundaryDirection(direction: BoundaryDirection): VerticalDirection;
export function toVerticalBoundaryDirection(direction: BoundaryDirection, key: string): VerticalDirection | null;
export function toVerticalBoundaryDirection(direction: BoundaryDirection, key?: string): VerticalDirection | null {
  if (key !== undefined && getVerticalArrowDirection(key) === null) return null;
  return direction === "previous" ? "up" : "down";
}
