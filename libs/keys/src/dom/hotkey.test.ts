import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalizeHotkey, eventMatchesParsedHotkey, parseHotkey } from "./hotkey.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeKeyEvent(
  key: string,
  mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {},
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    ctrlKey: mods.ctrl ?? false,
    metaKey: mods.meta ?? false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
  });
}

// The provider parses once at registration and matches the pre-parsed form at
// dispatch time (providers/keyboard.tsx), so the table below drives that pair.
describe("parseHotkey + eventMatchesParsedHotkey", () => {
  it.each([
    {
      description: "matches a bare key by name",
      event: makeKeyEvent("Enter"),
      hotkey: "Enter",
      expected: true,
    },
    {
      description: "matches a key with the Ctrl modifier",
      event: makeKeyEvent("s", { ctrl: true }),
      hotkey: "Ctrl+s",
      expected: true,
    },
    {
      description: "is case insensitive for multi-char keys",
      event: makeKeyEvent("Enter"),
      hotkey: "enter",
      expected: true,
    },
    {
      description: "matches when multiple modifiers are held",
      event: makeKeyEvent("z", { ctrl: true, shift: true }),
      hotkey: "Ctrl+Shift+Z",
      expected: true,
    },
    {
      description: "does not match when the key differs",
      event: makeKeyEvent("a"),
      hotkey: "b",
      expected: false,
    },
    {
      description: "does not match when the required modifier is missing",
      event: makeKeyEvent("s"),
      hotkey: "Ctrl+S",
      expected: false,
    },
    {
      description: "does not match when an extra modifier is held",
      event: makeKeyEvent("s", { ctrl: true }),
      hotkey: "s",
      expected: false,
    },
  ])("$description (event vs hotkey '$hotkey') -> $expected", ({ event, hotkey, expected }) => {
    expect(eventMatchesParsedHotkey(event, parseHotkey(hotkey))).toBe(expected);
  });

  it.each([
    { event: makeKeyEvent("Escape"), hotkey: "esc" },
    { event: makeKeyEvent("ArrowUp"), hotkey: "up" },
    { event: makeKeyEvent(" "), hotkey: "space" },
    { event: makeKeyEvent("?", { shift: true }), hotkey: "shift+question" },
    { event: makeKeyEvent("+"), hotkey: "plus" },
    { event: makeKeyEvent("/"), hotkey: "slash" },
    { event: makeKeyEvent("!", { shift: true }), hotkey: "shift+exclamation" },
    { event: makeKeyEvent("+"), hotkey: "+" },
  ])("resolves alias '$hotkey' to its canonical key", ({ event, hotkey }) => {
    expect(eventMatchesParsedHotkey(event, parseHotkey(hotkey))).toBe(true);
  });

  it("resolves 'mod' to meta on Mac (lazy isMac)", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)" });

    // Re-import to get a fresh module with reset _isMac cache
    vi.resetModules();
    const freshHotkey = await import("./hotkey.js");
    const parsed = freshHotkey.parseHotkey("mod+k");

    expect(freshHotkey.eventMatchesParsedHotkey(makeKeyEvent("k", { meta: true }), parsed)).toBe(
      true,
    );
    expect(freshHotkey.eventMatchesParsedHotkey(makeKeyEvent("k", { ctrl: true }), parsed)).toBe(
      false,
    );
  });

  it("resolves 'mod' to ctrl on non-Mac and ignores meta", () => {
    // In jsdom, navigator.userAgent does not contain "Mac"
    // so mod should resolve to ctrl
    const parsed = parseHotkey("mod+k");
    expect(eventMatchesParsedHotkey(makeKeyEvent("k", { ctrl: true }), parsed)).toBe(true);
    expect(eventMatchesParsedHotkey(makeKeyEvent("k", { meta: true }), parsed)).toBe(false);
  });

  it("does not match a 'mod' hotkey when no modifier is held", () => {
    expect(eventMatchesParsedHotkey(makeKeyEvent("k"), parseHotkey("mod+k"))).toBe(false);
  });

  describe("unknown modifier validation", () => {
    it("returns false for an unknown modifier", () => {
      expect(
        eventMatchesParsedHotkey(makeKeyEvent("k", { ctrl: true }), parseHotkey("Hyper+k")),
      ).toBe(false);
    });

    it("returns false for partially valid modifiers when one is unknown", () => {
      expect(
        eventMatchesParsedHotkey(makeKeyEvent("k", { ctrl: true }), parseHotkey("Ctrl+Hyper+k")),
      ).toBe(false);
    });
  });

  describe("uppercase letter shift matching", () => {
    it("matches uppercase G when shift is held", () => {
      expect(eventMatchesParsedHotkey(makeKeyEvent("G", { shift: true }), parseHotkey("G"))).toBe(
        true,
      );
    });

    it("matches explicit shift+g when shift is held", () => {
      expect(
        eventMatchesParsedHotkey(makeKeyEvent("G", { shift: true }), parseHotkey("shift+g")),
      ).toBe(true);
    });

    it("does not match uppercase G hotkey without shift", () => {
      expect(eventMatchesParsedHotkey(makeKeyEvent("g"), parseHotkey("G"))).toBe(false);
    });

    it("matches lowercase g without shift", () => {
      expect(eventMatchesParsedHotkey(makeKeyEvent("g"), parseHotkey("g"))).toBe(true);
    });
  });
});

describe("canonicalizeHotkey", () => {
  it("collapses aliases to the same canonical form", () => {
    expect(canonicalizeHotkey("esc")).toBe(canonicalizeHotkey("Escape"));
    expect(canonicalizeHotkey("up")).toBe(canonicalizeHotkey("ArrowUp"));
    expect(canonicalizeHotkey("space")).toBe(canonicalizeHotkey(" "));
  });

  it("sorts modifiers consistently", () => {
    expect(canonicalizeHotkey("Shift+Ctrl+s")).toBe(canonicalizeHotkey("Ctrl+Shift+s"));
  });

  it("normalizes shifted punctuation aliases", () => {
    expect(canonicalizeHotkey("shift+question")).toBe(canonicalizeHotkey("shift+?"));
  });

  it("handles the bare plus key without breaking the delimiter", () => {
    // "plus" alias resolves to "+", which is also the delimiter
    expect(canonicalizeHotkey("plus")).toBe(canonicalizeHotkey("+"));
    expect(canonicalizeHotkey("mod+plus")).toBe(canonicalizeHotkey("mod++"));
  });

  it("normalizes uppercase letter to shift+lowercase", () => {
    expect(canonicalizeHotkey("G")).toBe(canonicalizeHotkey("shift+g"));
  });
});

describe("parseHotkey", () => {
  it("resolves aliases to their canonical key", () => {
    expect(parseHotkey("esc").key).toBe("escape");
    expect(parseHotkey("up").key).toBe("arrowup");
    expect(parseHotkey("space").key).toBe(" ");
  });

  it("resolves shifted punctuation aliases", () => {
    expect(parseHotkey("shift+question")).toMatchObject({ key: "?", shift: true });
  });

  it("treats a trailing '+' segment as the '+' key", () => {
    expect(parseHotkey("+").key).toBe("+");
    expect(parseHotkey("mod++").key).toBe("+");
  });

  it("derives shift from an uppercase single-character key", () => {
    expect(parseHotkey("G")).toMatchObject({ key: "g", shift: true });
  });

  it("flags unknown modifiers without throwing", () => {
    expect(parseHotkey("Hyper+k").unknownModifier).toBe(true);
    expect(parseHotkey("Ctrl+k").unknownModifier).toBe(false);
  });

  it("resolves 'mod' to ctrl on non-Mac", () => {
    const parsed = parseHotkey("mod+k");
    expect(parsed.ctrl).toBe(true);
    expect(parsed.meta).toBe(false);
  });

  it("produces a parse that dispatch matching and the canonical serialization agree on", () => {
    expect(canonicalizeHotkey("Ctrl+Shift+z")).toBe("ctrl+shift+z");
    expect(
      eventMatchesParsedHotkey(
        makeKeyEvent("z", { ctrl: true, shift: true }),
        parseHotkey("Ctrl+Shift+z"),
      ),
    ).toBe(true);
  });
});
