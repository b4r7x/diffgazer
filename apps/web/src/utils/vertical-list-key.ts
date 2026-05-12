const VERTICAL_LIST_KEYS = new Set(["ArrowUp", "ArrowDown", "Home", "End", "Enter", " "]);

export function isVerticalListKey(key: string): boolean {
  return VERTICAL_LIST_KEYS.has(key);
}
