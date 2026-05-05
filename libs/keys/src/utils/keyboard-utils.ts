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
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}
