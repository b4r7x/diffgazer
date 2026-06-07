import { describe, expect, it, vi } from "vitest";
import { canonicalizeHotkey, matchesHotkey } from "./hotkey.js";

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

describe("matchesHotkey", () => {
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
    expect(matchesHotkey(event, hotkey)).toBe(expected);
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
    expect(matchesHotkey(event, hotkey)).toBe(true);
  });

  it("resolves 'mod' to meta on Mac (lazy isMac)", async () => {
    // isMac is now lazy — reset module to test Mac detection
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)" },
      writable: true,
      configurable: true,
    });

    // Re-import to get a fresh module with reset _isMac cache
    vi.resetModules();
    const { matchesHotkey: freshMatchesHotkey } = await import("./hotkey.js");

    expect(freshMatchesHotkey(makeKeyEvent("k", { meta: true }), "mod+k")).toBe(true);
    expect(freshMatchesHotkey(makeKeyEvent("k", { ctrl: true }), "mod+k")).toBe(false);

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("resolves 'mod' to ctrl on non-Mac and ignores meta", () => {
    // In jsdom, navigator.userAgent does not contain "Mac"
    // so mod should resolve to ctrl
    expect(matchesHotkey(makeKeyEvent("k", { ctrl: true }), "mod+k")).toBe(true);
    expect(matchesHotkey(makeKeyEvent("k", { meta: true }), "mod+k")).toBe(false);
  });

  it("does not match a 'mod' hotkey when no modifier is held", () => {
    expect(matchesHotkey(makeKeyEvent("k"), "mod+k")).toBe(false);
  });

  describe("unknown modifier validation", () => {
    it("returns false for an unknown modifier", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(matchesHotkey(makeKeyEvent("k", { ctrl: true }), "Hyper+k")).toBe(false);
      spy.mockRestore();
    });

    it("warns in development for an unknown modifier", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      matchesHotkey(makeKeyEvent("k"), "Super+k");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("unknown modifier"));
      spy.mockRestore();
    });

    it("returns false for partially valid modifiers when one is unknown", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(matchesHotkey(makeKeyEvent("k", { ctrl: true }), "Ctrl+Hyper+k")).toBe(false);
      spy.mockRestore();
    });
  });

  describe("uppercase letter shift matching", () => {
    it("matches uppercase G when shift is held", () => {
      expect(matchesHotkey(makeKeyEvent("G", { shift: true }), "G")).toBe(true);
    });

    it("matches explicit shift+g when shift is held", () => {
      expect(matchesHotkey(makeKeyEvent("G", { shift: true }), "shift+g")).toBe(true);
    });

    it("does not match uppercase G hotkey without shift", () => {
      expect(matchesHotkey(makeKeyEvent("g"), "G")).toBe(false);
    });

    it("matches lowercase g without shift", () => {
      expect(matchesHotkey(makeKeyEvent("g"), "g")).toBe(true);
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
