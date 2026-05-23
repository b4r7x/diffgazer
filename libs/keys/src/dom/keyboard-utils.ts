import { isHTMLElement, isHTMLInputElement, isHTMLTextAreaElement } from "./dom.js";

// Ambient declaration so copy-mode consumers without @types/node can still
// type-check the dev-only console.warn guards below.
declare const process: { env: { NODE_ENV?: string } } | undefined;

const KEY_ALIASES: Record<string, string> = {
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  esc: "escape",
  space: " ",
  // Shifted punctuation aliases — lets hotkey strings reference these
  // characters by name when '+' is the modifier delimiter.
  question: "?",
  plus: "+",
  exclamation: "!",
  at: "@",
  hash: "#",
  dollar: "$",
  percent: "%",
  caret: "^",
  ampersand: "&",
  asterisk: "*",
  tilde: "~",
  pipe: "|",
  backslash: "\\",
  slash: "/",
};

const KNOWN_MODIFIERS = new Set(["ctrl", "meta", "shift", "alt", "mod"]);

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

/**
 * Canonicalize a hotkey string so that aliases like "esc" and "Escape"
 * resolve to the same form. Used at registration time to ensure two
 * registrations for the same physical hotkey share a single slot.
 */
export function canonicalizeHotkey(hotkey: string): string {
  const rawParts = hotkey.split("+");
  let rawKey = rawParts.pop() ?? "";
  if (rawKey === "" && rawParts.length > 0) {
    rawKey = "+";
    while (rawParts.length > 0 && rawParts[rawParts.length - 1] === "") {
      rawParts.pop();
    }
  }
  const parts = rawParts.map(p => p.toLowerCase());

  for (const part of parts) {
    if (!KNOWN_MODIFIERS.has(part)) {
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        console.warn(
          `canonicalizeHotkey: unknown modifier "${part}" in hotkey "${hotkey}". ` +
          `Known modifiers: ${[...KNOWN_MODIFIERS].join(", ")}.`,
        );
      }
    }
  }

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
  const sortedMods = [...mods].sort();
  return [...sortedMods, normalizedKey].join("+");
}

export function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const rawParts = hotkey.split("+");
  let rawKey = rawParts.pop() ?? "";
  // When split produces an empty last segment (hotkey ends with "+" or is
  // just "+"), the actual key is "+".
  if (rawKey === "" && rawParts.length > 0) {
    rawKey = "+";
    // The empty entry before it came from the delimiter, not a modifier.
    // Remove trailing empty parts introduced by the split.
    while (rawParts.length > 0 && rawParts[rawParts.length - 1] === "") {
      rawParts.pop();
    }
  }
  const parts = rawParts.map(p => p.toLowerCase());

  for (const part of parts) {
    if (!KNOWN_MODIFIERS.has(part)) {
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        console.warn(
          `matchesHotkey: unknown modifier "${part}" in hotkey "${hotkey}". ` +
          `Known modifiers: ${[...KNOWN_MODIFIERS].join(", ")}.`,
        );
      }
      return false;
    }
  }

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
