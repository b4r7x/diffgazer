/** Vertical movement direction derived from ArrowUp/ArrowDown, their k/j aliases, or boundaries. */
export type VerticalDirection = "up" | "down";

/** Orientation-neutral boundary direction emitted by navigation hooks. */
export type BoundaryDirection = "previous" | "next";

const LIST_NAVIGATION_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "j",
  "k",
  "Home",
  "End",
  "Enter",
  " ",
]);

/**
 * Returns true for keys a list may consume, including the j/k vim aliases. The aliases are not
 * vertical defaults: list components opt into them through `upKeys`/`downKeys`.
 */
export function isListNavigationKey(key: string): boolean {
  return LIST_NAVIGATION_KEYS.has(key);
}

/** Maps ArrowUp/ArrowDown and their k/j vim aliases to a semantic vertical direction. */
export function getVerticalArrowDirection(key: string): VerticalDirection | null {
  if (key === "ArrowUp" || key === "k") return "up";
  if (key === "ArrowDown" || key === "j") return "down";
  return null;
}

/** Converts a previous/next boundary to up/down. */
export function toVerticalBoundaryDirection(direction: BoundaryDirection): VerticalDirection;
/** Converts a boundary to up/down only when the triggering key was vertical. */
export function toVerticalBoundaryDirection(
  direction: BoundaryDirection,
  key: string,
): VerticalDirection | null;
/** Implementation for boundary-to-vertical direction mapping. */
export function toVerticalBoundaryDirection(
  direction: BoundaryDirection,
  key?: string,
): VerticalDirection | null {
  if (key !== undefined && getVerticalArrowDirection(key) === null) return null;
  return direction === "previous" ? "up" : "down";
}
