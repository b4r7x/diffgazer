import { describe, expect, it } from "vitest";
import { capitalize, pluralize, truncate } from "./strings.js";

describe("capitalize", () => {
  it.each([
    ["hello", "Hello"],
    ["", ""],
  ])("capitalizes %j as %j", (input, expected) => {
    expect(capitalize(input)).toBe(expected);
  });
});

describe("truncate", () => {
  it.each([
    ["hi", 10, undefined, "hi"],
    ["hello", 5, undefined, "hello"],
    ["abcdefghij", 6, undefined, "abc..."],
    ["abcdefghij", 6, "~", "abcde~"],
    ["hello world", 2, undefined, ".."],
    ["hello world", 0, undefined, ""],
    ["hello world", 3, undefined, "..."],
    ["", 5, undefined, ""],
  ])("truncates %j to length %s with suffix %j", (input, maxLength, suffix, expected) => {
    expect(truncate(input, maxLength, suffix)).toBe(expected);
  });

  it.each([
    ["123\u{1F600}456", 7, undefined, "123\u{1F600}456"],
    ["\u{1F600}".repeat(4), 3, "~", "\u{1F600}\u{1F600}~"],
    ["e\u0301".repeat(4), 3, "~", "e\u0301e\u0301~"],
    [
      "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}a",
      2,
      undefined,
      "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}a",
    ],
  ])("counts %j in grapheme clusters at length %s", (input, maxLength, suffix, expected) => {
    expect(truncate(input, maxLength, suffix)).toBe(expected);
  });
});

describe("pluralize", () => {
  it.each([
    [0, "issue", "0 issues"],
    [1, "issue", "1 issue"],
    [2, "issue", "2 issues"],
  ])("pluralizes %s %j as %j", (count, word, expected) => {
    expect(pluralize(count, word)).toBe(expected);
  });

  it.each([
    [1, "lens", "lenses", "1 lens"],
    [2, "lens", "lenses", "2 lenses"],
  ])("uses the explicit plural for irregular nouns", (count, word, plural, expected) => {
    expect(pluralize(count, word, plural)).toBe(expected);
  });
});
