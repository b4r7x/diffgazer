import type { Key } from "ink";

export function applyTextEditKey(value: string, input: string, key: Key): string | null {
  if (key.backspace) {
    return Array.from(value).slice(0, -1).join("");
  }
  if (key.return || key.escape || key.upArrow || key.downArrow || key.tab) {
    return null;
  }
  if (input.length >= 1 && !key.ctrl && !key.meta) {
    return value + input;
  }
  return null;
}
