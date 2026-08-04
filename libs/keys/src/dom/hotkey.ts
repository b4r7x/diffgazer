const KEY_ALIASES: Record<string, string> = {
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  esc: "escape",
  space: " ",
  // Name aliases for chars unusable literally when '+' is the modifier delimiter.
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

/**
 * Closed hotkey modifier vocabulary. {@link ValidateHotkey} rejects anything
 * outside it for string literals; {@link parseHotkey} flags the rest at runtime.
 */
export type HotkeyModifier = "ctrl" | "meta" | "shift" | "alt" | "mod";

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

/** Parsed representation of a hotkey string after alias and modifier resolution. */
export interface ParsedHotkey {
  /** Whether Ctrl must be pressed. */
  ctrl: boolean;
  /** Whether Meta must be pressed. */
  meta: boolean;
  /** Whether Shift must be pressed. */
  shift: boolean;
  /** Whether Alt must be pressed. */
  alt: boolean;
  /** Normalized (alias-resolved, lowercased) key the hotkey targets. */
  key: string;
  /** True when a `+`-delimited modifier segment was outside the closed vocabulary. */
  unknownModifier: boolean;
  /**
   * The raw (lowercased) modifier segments outside the closed vocabulary, kept
   * so the canonical serialization stays distinct from a legitimate hotkey that
   * would otherwise share the same key (a typo cannot collide).
   */
  unknownModifiers: string[];
}

function splitHotkey(hotkey: string): { mods: string[]; rawKey: string } {
  const rawParts = hotkey.split("+");
  let rawKey = rawParts.pop() ?? "";
  // Trailing "+" (or bare "+") splits to an empty key: the key is "+"; drop the
  // delimiter-produced empty parts so they aren't read as modifiers.
  if (rawKey === "" && rawParts.length > 0) {
    rawKey = "+";
    while (rawParts.length > 0 && rawParts[rawParts.length - 1] === "") {
      rawParts.pop();
    }
  }
  return { mods: rawParts.map((part) => part.toLowerCase()), rawKey };
}

/**
 * Single source of truth for hotkey string interpretation. Resolves aliases,
 * `mod`→meta/ctrl by platform, shift-from-uppercase, the normalized key, and
 * flags any modifier segment outside the closed {@link HotkeyModifier}
 * vocabulary via `unknownModifier`.
 */
export function parseHotkey(hotkey: string): ParsedHotkey {
  const { mods, rawKey } = splitHotkey(hotkey);

  const unknownModifiers: string[] = [];
  const flags = { ctrl: false, meta: false, shift: false, alt: false };
  let resolveMod = false;

  for (const mod of mods) {
    switch (mod) {
      case "ctrl":
        flags.ctrl = true;
        break;
      case "meta":
        flags.meta = true;
        break;
      case "shift":
        flags.shift = true;
        break;
      case "alt":
        flags.alt = true;
        break;
      case "mod":
        resolveMod = true;
        break;
      default:
        unknownModifiers.push(mod);
    }
  }

  if (rawKey.length === 1 && rawKey !== rawKey.toLowerCase()) {
    flags.shift = true;
  }

  if (resolveMod) {
    if (isMac()) flags.meta = true;
    else flags.ctrl = true;
  }

  const lowerKey = rawKey.toLowerCase();
  return {
    ...flags,
    key: KEY_ALIASES[lowerKey] ?? lowerKey,
    unknownModifier: unknownModifiers.length > 0,
    unknownModifiers,
  };
}

/**
 * Serializes a parsed hotkey into canonical modifier order while preserving
 * unknown modifier segments so typoed hotkeys cannot collide.
 */
export function serializeParsedHotkey(parsed: ParsedHotkey): string {
  const mods: string[] = [];
  if (parsed.ctrl) mods.push("ctrl");
  if (parsed.meta) mods.push("meta");
  if (parsed.shift) mods.push("shift");
  if (parsed.alt) mods.push("alt");
  return [...mods.sort(), ...[...parsed.unknownModifiers].sort(), parsed.key].join("+");
}

/**
 * Normalizes a hotkey string so aliases and modifier orderings collapse to a
 * single canonical form.
 */
export function canonicalizeHotkey<S extends string>(hotkey: ValidateHotkey<S>): string {
  return serializeParsedHotkey(parseHotkey(hotkey as string));
}

/** Returns whether a keyboard event matches an already parsed hotkey. */
export function eventMatchesParsedHotkey(event: KeyboardEvent, parsed: ParsedHotkey): boolean {
  if (parsed.unknownModifier) return false;
  return (
    event.key.toLowerCase() === parsed.key &&
    event.ctrlKey === parsed.ctrl &&
    event.metaKey === parsed.meta &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt
  );
}

/**
 * Returns whether a keyboard event matches a hotkey string, resolving aliases
 * and `mod` platform behavior before comparison.
 */
export function matchesHotkey<S extends string>(
  event: KeyboardEvent,
  hotkey: ValidateHotkey<S>,
): boolean {
  return eventMatchesParsedHotkey(event, parseHotkey(hotkey as string));
}

/**
 * Compile-time validation for hotkey string literals: every `+`-delimited
 * segment before the final key must be a known {@link HotkeyModifier} (matched
 * case-insensitively, mirroring the runtime lowercase). The final key segment
 * is unconstrained, and non-literal `string` passes through so dynamically
 * built hotkeys keep compiling.
 */
export type ValidateHotkey<S extends string> = string extends S
  ? string
  : ValidateHotkeyParts<S, S>;

type ValidateHotkeyParts<
  S extends string,
  Original extends string,
> = S extends `${infer Head}+${infer Rest}`
  ? Rest extends ""
    ? Original // trailing "+" means the final key is "+"; nothing left to constrain
    : Lowercase<Head> extends HotkeyModifier
      ? ValidateHotkeyParts<Rest, Original>
      : Original & `Unknown hotkey modifier: "${Head}"`
  : Original; // final key segment is unconstrained
