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
    ["hello world", 8, undefined, "hello..."],
    ["hi", 10, undefined, "hi"],
    ["hello", 5, undefined, "hello"],
    ["abcdefghij", 6, undefined, "abc..."],
    ["abcdefghij", 6, "~", "abcde~"],
    ["hello world", 2, undefined, ".."],
    ["hello world", 1, undefined, "."],
    ["hello world", 0, undefined, ""],
    ["hello world", 3, undefined, "..."],
    ["", 5, undefined, ""],
  ])("truncates %j to length %s with suffix %j", (input, maxLength, suffix, expected) => {
    expect(truncate(input, maxLength, suffix)).toBe(expected);
  });
});

describe("pluralize", () => {
  it.each([
    [0, "issue", "0 issues"],
    [1, "issue", "1 issue"],
    [2, "issue", "2 issues"],
    [1, "file", "1 file"],
    [3, "agent", "3 agents"],
  ])("pluralizes %s %j as %j", (count, word, expected) => {
    expect(pluralize(count, word)).toBe(expected);
  });
});
