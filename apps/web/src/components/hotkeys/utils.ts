import type { KeyModifiers, ParsedKey } from "./types";

const KEY_ALIASES: Record<string, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  esc: "Escape",
  enter: "Enter",
  space: " ",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
};

const MODIFIER_KEYS = new Set(["ctrl", "alt", "shift", "meta"]);

export function parseKey(keyCombo: string): ParsedKey {
  const parts = keyCombo.toLowerCase().split("+");
  const modifiers: KeyModifiers = {};
  let key = "";

  for (const part of parts) {
    const trimmed = part.trim();
    if (MODIFIER_KEYS.has(trimmed)) {
      modifiers[trimmed as keyof KeyModifiers] = true;
    } else {
      key = KEY_ALIASES[trimmed] ?? trimmed;
    }
  }

  return { key, modifiers };
}

export function matchesKey(event: KeyboardEvent, parsed: ParsedKey): boolean {
  const eventKey = event.key.toLowerCase();
  const parsedKey = parsed.key.toLowerCase();

  if (eventKey !== parsedKey) {
    return false;
  }

  const { modifiers } = parsed;
  if (!!modifiers.ctrl !== event.ctrlKey) return false;
  if (!!modifiers.alt !== event.altKey) return false;
  if (!!modifiers.shift !== event.shiftKey) return false;
  if (!!modifiers.meta !== event.metaKey) return false;

  return true;
}

const DISPLAY_MAP: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  Enter: "⏎",
  " ": "Space",
  Backspace: "⌫",
  Delete: "Del",
  Tab: "Tab",
};

export function formatKeyForDisplay(keyCombo: string): string {
  const parsed = parseKey(keyCombo);
  const parts: string[] = [];

  if (parsed.modifiers.ctrl) parts.push("Ctrl");
  if (parsed.modifiers.alt) parts.push("Alt");
  if (parsed.modifiers.shift) parts.push("Shift");
  if (parsed.modifiers.meta) parts.push("⌘");

  const displayKey =
    DISPLAY_MAP[parsed.key] ?? parsed.key.toUpperCase();
  parts.push(displayKey);

  return parts.join("+");
}

export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  return target.isContentEditable;
}
