import { describe, it, expect, vi } from "vitest";
import { matchesHotkey, isInputElement, isEditableElement } from "./keyboard-utils";

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
  it.each([
    { description: "matches a bare key by name", event: makeKeyEvent("Enter"), hotkey: "Enter", expected: true },
    { description: "matches a key with the Ctrl modifier", event: makeKeyEvent("s", { ctrl: true }), hotkey: "Ctrl+s", expected: true },
    { description: "is case insensitive for multi-char keys", event: makeKeyEvent("Enter"), hotkey: "enter", expected: true },
    { description: "matches when multiple modifiers are held", event: makeKeyEvent("z", { ctrl: true, shift: true }), hotkey: "Ctrl+Shift+Z", expected: true },
    { description: "does not match when the key differs", event: makeKeyEvent("a"), hotkey: "b", expected: false },
    { description: "does not match when the required modifier is missing", event: makeKeyEvent("s"), hotkey: "Ctrl+S", expected: false },
    { description: "does not match when an extra modifier is held", event: makeKeyEvent("s", { ctrl: true }), hotkey: "s", expected: false },
  ])("$description (event vs hotkey '$hotkey') -> $expected", ({ event, hotkey, expected }) => {
    expect(matchesHotkey(event, hotkey)).toBe(expected);
  });

  it.each([
    { event: makeKeyEvent("Escape"), hotkey: "esc" },
    { event: makeKeyEvent("ArrowUp"), hotkey: "up" },
    { event: makeKeyEvent(" "), hotkey: "space" },
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
    const { matchesHotkey: freshMatchesHotkey } = await import("./keyboard-utils");

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
  it.each([
    { tag: "input", expected: true },
    { tag: "textarea", expected: true },
    { tag: "select", expected: true },
  ])("classifies native <$tag> as an input element ($expected)", ({ tag, expected }) => {
    expect(isInputElement(document.createElement(tag))).toBe(expected);
  });

  it("does not classify a plain <div> as an input element", () => {
    // jsdom's isContentEditable is undefined, so the return is not strictly false.
    // In real browsers this returns false.
    expect(isInputElement(document.createElement("div"))).toBeFalsy();
  });

  it("returns false for a null target", () => {
    expect(isInputElement(null)).toBe(false);
  });
});

describe("isEditableElement", () => {
  it("returns true for input elements except non-text inputs", () => {
    const text = document.createElement("input");
    text.type = "text";
    expect(isEditableElement(text)).toBe(true);

    const search = document.createElement("input");
    search.type = "search";
    expect(isEditableElement(search)).toBe(true);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isEditableElement(checkbox)).toBe(false);

    const radio = document.createElement("input");
    radio.type = "radio";
    expect(isEditableElement(radio)).toBe(false);

    const button = document.createElement("input");
    button.type = "button";
    expect(isEditableElement(button)).toBe(false);
  });

  it("returns true for textarea", () => {
    expect(isEditableElement(document.createElement("textarea"))).toBe(true);
  });

  it("returns true for contenteditable elements", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.append(div);
    try {
      // jsdom does not implement isContentEditable; we use the attribute
      expect(isEditableElement(div)).toBe(true);
    } finally {
      div.remove();
    }
  });

  it("returns false for select (not text-editable)", () => {
    expect(isEditableElement(document.createElement("select"))).toBe(false);
  });

  it("returns false for div without contenteditable", () => {
    expect(isEditableElement(document.createElement("div"))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isEditableElement(null)).toBe(false);
  });

  it("returns false for readonly inputs", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.readOnly = true;
    expect(isEditableElement(input)).toBe(false);
  });

  it("returns false for disabled inputs", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.disabled = true;
    expect(isEditableElement(input)).toBe(false);
  });
});
