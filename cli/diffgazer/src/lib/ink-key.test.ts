import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { Key } from "ink";
import { inkKeyToHotkey, isLetterKey } from "./ink-key.js";

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
    assert.equal(inkKeyToHotkey("", { ...emptyKey, escape: true }), "escape");
  });

  test("maps arrows", () => {
    assert.equal(inkKeyToHotkey("", { ...emptyKey, upArrow: true }), "up");
    assert.equal(inkKeyToHotkey("", { ...emptyKey, downArrow: true }), "down");
    assert.equal(inkKeyToHotkey("", { ...emptyKey, leftArrow: true }), "left");
    assert.equal(inkKeyToHotkey("", { ...emptyKey, rightArrow: true }), "right");
  });

  test("maps return and tab", () => {
    assert.equal(inkKeyToHotkey("", { ...emptyKey, return: true }), "return");
    assert.equal(inkKeyToHotkey("", { ...emptyKey, tab: true }), "tab");
  });

  test("maps page up/down", () => {
    assert.equal(inkKeyToHotkey("", { ...emptyKey, pageUp: true }), "pageup");
    assert.equal(inkKeyToHotkey("", { ...emptyKey, pageDown: true }), "pagedown");
  });

  test("falls back to input for printable keys", () => {
    assert.equal(inkKeyToHotkey("a", emptyKey), "a");
    assert.equal(inkKeyToHotkey("1", emptyKey), "1");
  });

  test("returns null when nothing matches", () => {
    assert.equal(inkKeyToHotkey("", emptyKey), null);
  });
});

describe("isLetterKey", () => {
  test("accepts single letters/digits/special chars", () => {
    assert.equal(isLetterKey("a"), true);
    assert.equal(isLetterKey("Z"), true);
    assert.equal(isLetterKey("4"), true);
    assert.equal(isLetterKey("?"), true);
    assert.equal(isLetterKey("/"), true);
  });

  test("rejects multi-character or non-letter keys", () => {
    assert.equal(isLetterKey("up"), false);
    assert.equal(isLetterKey(""), false);
    assert.equal(isLetterKey("@"), false);
  });
});
