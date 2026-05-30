import { describe, it, expect } from "vitest";
import { capitalize, truncate } from "./strings";

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
