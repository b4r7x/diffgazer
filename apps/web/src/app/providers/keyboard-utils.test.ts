import { describe, it, expect } from "vitest";
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
    expect(matchesHotkey(makeKeyEvent("s", { ctrl: true }), "Ctrl+S")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(matchesHotkey(makeKeyEvent("Enter"), "enter")).toBe(true);
    expect(matchesHotkey(makeKeyEvent("a"), "A")).toBe(true);
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

  it("should return false for span element", () => {
    const span = document.createElement("span");
    expect(isInputElement(span)).toBeFalsy();
  });

  // jsdom does not implement isContentEditable (returns undefined),
  // so this test cannot run in jsdom.
  it.skip("should return true for contentEditable element (requires real DOM)", () => {
    const div = document.createElement("div");
    div.contentEditable = "true";
    expect(isInputElement(div)).toBe(true);
  });

  it("should return false for null target", () => {
    expect(isInputElement(null)).toBe(false);
  });
});
