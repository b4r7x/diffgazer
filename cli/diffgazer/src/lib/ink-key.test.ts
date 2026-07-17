import type { Key } from "ink";
import { describe, expect, test } from "vitest";
import { inkKeyToHotkey, isTypeableShortcutKey } from "./ink-key";

const emptyKey: Key = {
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  pageDown: false,
  pageUp: false,
  home: false,
  end: false,
  return: false,
  escape: false,
  ctrl: false,
  shift: false,
  tab: false,
  backspace: false,
  delete: false,
  meta: false,
  super: false,
  hyper: false,
  capsLock: false,
  numLock: false,
};

describe("inkKeyToHotkey", () => {
  test("maps escape", () => {
    expect(inkKeyToHotkey("", { ...emptyKey, escape: true })).toBe("escape");
  });

  test.each([
    { flag: "upArrow" as const, hotkey: "up" },
    { flag: "downArrow" as const, hotkey: "down" },
    { flag: "leftArrow" as const, hotkey: "left" },
    { flag: "rightArrow" as const, hotkey: "right" },
  ])("maps $flag flag to '$hotkey' hotkey", ({ flag, hotkey }) => {
    expect(inkKeyToHotkey("", { ...emptyKey, [flag]: true })).toBe(hotkey);
  });

  test.each([
    { flag: "return" as const, hotkey: "return" },
    { flag: "tab" as const, hotkey: "tab" },
    { flag: "pageUp" as const, hotkey: "pageup" },
    { flag: "pageDown" as const, hotkey: "pagedown" },
  ])("maps $flag flag to '$hotkey' hotkey", ({ flag, hotkey }) => {
    expect(inkKeyToHotkey("", { ...emptyKey, [flag]: true })).toBe(hotkey);
  });

  test.each([{ input: "a" }, { input: "1" }])("falls back to printable input '$input'", ({
    input,
  }) => {
    expect(inkKeyToHotkey(input, emptyKey)).toBe(input);
  });

  test.each([
    { modifier: "ctrl" as const },
    { modifier: "meta" as const },
    { modifier: "super" as const },
    { modifier: "hyper" as const },
  ])("rejects printable input with the $modifier modifier", ({ modifier }) => {
    expect(inkKeyToHotkey("s", { ...emptyKey, [modifier]: true })).toBe(null);
  });

  test("rejects escape-prefixed printable input even when modifier flags are missing", () => {
    expect(inkKeyToHotkey("\u001bs", emptyKey)).toBe(null);
  });

  test("preserves modified navigation keys", () => {
    expect(inkKeyToHotkey("", { ...emptyKey, ctrl: true, upArrow: true })).toBe("up");
  });

  test("returns null when nothing matches", () => {
    expect(inkKeyToHotkey("", emptyKey)).toBe(null);
  });
});

describe("isTypeableShortcutKey", () => {
  test.each([
    { input: "a" },
    { input: "Z" },
    { input: "4" },
    { input: "?" },
    { input: "/" },
  ])("accepts single character '$input'", ({ input }) => {
    expect(isTypeableShortcutKey(input)).toBe(true);
  });

  test.each([
    { input: "up", reason: "multi-character" },
    { input: "", reason: "empty string" },
    { input: "@", reason: "non-letter symbol outside the printable letter set" },
  ])("rejects $reason ('$input')", ({ input }) => {
    expect(isTypeableShortcutKey(input)).toBe(false);
  });
});
