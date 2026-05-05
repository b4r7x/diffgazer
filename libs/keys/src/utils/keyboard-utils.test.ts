import { describe, it, expect, vi } from "vitest";
import { matchesHotkey, isInputElement } from "./keyboard-utils";

function makeKeyEvent(
  key: string,
  mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}
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
  it("should match a simple key", () => {
    expect(matchesHotkey(makeKeyEvent("Enter"), "Enter")).toBe(true);
  });

  it("should match key with Ctrl modifier", () => {
    expect(matchesHotkey(makeKeyEvent("s", { ctrl: true }), "Ctrl+s")).toBe(true);
  });

  it("should be case insensitive for multi-char keys", () => {
    expect(matchesHotkey(makeKeyEvent("Enter"), "enter")).toBe(true);
  });

  it("should match multiple modifiers", () => {
    const event = makeKeyEvent("z", { ctrl: true, shift: true });
    expect(matchesHotkey(event, "Ctrl+Shift+Z")).toBe(true);
  });

  it("should not match when key differs", () => {
    expect(matchesHotkey(makeKeyEvent("a"), "b")).toBe(false);
  });

  it("should not match when modifier is missing", () => {
    expect(matchesHotkey(makeKeyEvent("s"), "Ctrl+S")).toBe(false);
  });

  it("should not match when extra modifier is present", () => {
    expect(matchesHotkey(makeKeyEvent("s", { ctrl: true }), "s")).toBe(false);
  });

  it("should resolve key aliases", () => {
    expect(matchesHotkey(makeKeyEvent("Escape"), "esc")).toBe(true);
    expect(matchesHotkey(makeKeyEvent("ArrowUp"), "up")).toBe(true);
    expect(matchesHotkey(makeKeyEvent(" "), "space")).toBe(true);
  });

  it("should resolve mod to meta on Mac (lazy isMac)", async () => {
    // isMac is now lazy — reset module to test Mac detection
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)" },
      writable: true,
      configurable: true,
    });

    // Re-import to get a fresh module with reset _isMac cache
    vi.resetModules();
    const { matchesHotkey: freshMatchesHotkey } = await import("./keyboard-utils");

    expect(freshMatchesHotkey(makeKeyEvent("k", { meta: true }), "mod+k")).toBe(true);
    expect(freshMatchesHotkey(makeKeyEvent("k", { ctrl: true }), "mod+k")).toBe(false);

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("should match mod+key as ctrl+key on non-Mac", () => {
    // In jsdom, navigator.userAgent does not contain "Mac"
    // so mod should resolve to ctrl
    expect(matchesHotkey(makeKeyEvent("k", { ctrl: true }), "mod+k")).toBe(true);
    expect(matchesHotkey(makeKeyEvent("k", { meta: true }), "mod+k")).toBe(false);
  });

  it("should not match mod+key without any modifier", () => {
    expect(matchesHotkey(makeKeyEvent("k"), "mod+k")).toBe(false);
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

describe("isInputElement", () => {
  it("should return true for input element", () => {
    const input = document.createElement("input");
    expect(isInputElement(input)).toBe(true);
  });

  it("should return true for textarea element", () => {
    const textarea = document.createElement("textarea");
    expect(isInputElement(textarea)).toBe(true);
  });

  it("should return true for select element", () => {
    const select = document.createElement("select");
    expect(isInputElement(select)).toBe(true);
  });

  it("should return false for div element", () => {
    const div = document.createElement("div");
    // jsdom's isContentEditable is undefined, so the return is not strictly false.
    // In real browsers this returns false.
    expect(isInputElement(div)).toBeFalsy();
  });

  it("should return false for null target", () => {
    expect(isInputElement(null)).toBe(false);
  });
});
