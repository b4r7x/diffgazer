import { isHTMLElement, isHTMLInputElement, isHTMLTextAreaElement } from "./dom.js";

const KEY_ALIASES: Record<string, string> = {
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  esc: "escape",
  space: " ",
};

let _isMac: boolean | null = null;
function isMac(): boolean {
  if (_isMac === null) {
    _isMac =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad/.test(navigator.userAgent);
  }
  return _isMac;
}

export function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const rawParts = hotkey.split("+");
  const rawKey = rawParts.pop() ?? "";
  const parts = rawParts.map(p => p.toLowerCase());
  const mods = new Set(parts);

  if (rawKey.length === 1 && rawKey !== rawKey.toLowerCase()) {
    mods.add("shift");
  }

  if (mods.has("mod")) {
    mods.delete("mod");
    if (isMac()) mods.add("meta");
    else mods.add("ctrl");
  }

  const normalizedKey = KEY_ALIASES[rawKey.toLowerCase()] ?? rawKey.toLowerCase();
  const eventKey = event.key.toLowerCase();

  return (
    eventKey === normalizedKey &&
    event.ctrlKey === mods.has("ctrl") &&
    event.metaKey === mods.has("meta") &&
    event.shiftKey === mods.has("shift") &&
    event.altKey === mods.has("alt")
  );
}

export function isInputElement(target: EventTarget | null): boolean {
  if (!isHTMLElement(target)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

const NON_EDITABLE_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function hasContentEditableAttribute(element: HTMLElement): boolean {
  if (element.isContentEditable) return true;
  const value = element.getAttribute("contenteditable");
  if (value === null) return false;
  return value === "" || value === "true" || value === "plaintext-only";
}

/**
 * Returns true when the target accepts text editing keys (Arrow/Home/End/Enter/Space).
 *
 * - text-like inputs (text, search, url, email, password, tel, number, date, ...)
 * - textarea
 * - contenteditable elements (true / "" / "plaintext-only")
 *
 * Returns false for select, checkboxes, radios, disabled/readonly inputs,
 * and elements whose contenteditable is "false".
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!isHTMLElement(target)) return false;

  if (isHTMLTextAreaElement(target)) {
    return !target.disabled && !target.readOnly;
  }

  if (isHTMLInputElement(target)) {
    if (target.disabled || target.readOnly) return false;
    const type = (target.type || "text").toLowerCase();
    return !NON_EDITABLE_INPUT_TYPES.has(type);
  }

  return hasContentEditableAttribute(target);
}
