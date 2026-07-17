import type { Key } from "ink";

export function inkKeyToHotkey(input: string, key: Key): string | null {
  if (key.escape) return "escape";
  if (key.return) return "return";
  if (key.upArrow) return "up";
  if (key.downArrow) return "down";
  if (key.leftArrow) return "left";
  if (key.rightArrow) return "right";
  if (key.tab) return "tab";
  if (key.backspace) return "backspace";
  if (key.delete) return "delete";
  if (key.pageUp) return "pageup";
  if (key.pageDown) return "pagedown";
  if (key.ctrl || key.meta || key.super || key.hyper || input.startsWith("\u001b")) return null;
  if (input) return input;
  return null;
}

export function isTypeableShortcutKey(hotkey: string): boolean {
  return hotkey.length === 1 && /^[a-zA-Z0-9?/]$/.test(hotkey);
}
