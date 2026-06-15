import { describe, expect, test } from "vitest";
import { detectPaletteNameFromColorFgBg } from "./provider.js";

describe("detectPaletteNameFromColorFgBg", () => {
  test.each([
    { value: "15;0", expected: "dark" as const },
    { value: "0;15", expected: "light" as const },
    { value: "8", expected: "dark" as const },
    { value: "7", expected: "light" as const },
    { value: "12;default;0", expected: "dark" as const },
  ])("maps COLORFGBG '$value' to the $expected palette (last segment wins)", ({
    value,
    expected,
  }) => {
    expect(detectPaletteNameFromColorFgBg(value)).toBe(expected);
  });

  test.each([0, 1, 2, 3, 4, 5, 6, 8])("treats background color %i as a dark terminal", (bg) => {
    expect(detectPaletteNameFromColorFgBg(`15;${bg}`)).toBe("dark");
  });

  test.each([
    7, 9, 10, 11, 12, 13, 14, 15,
  ])("treats background color %i as a light terminal", (bg) => {
    expect(detectPaletteNameFromColorFgBg(`0;${bg}`)).toBe("light");
  });

  test.each([
    undefined,
    "",
    "garbage",
    "default;foo",
  ])("defaults to dark for the missing/unparsable value %p", (value) => {
    expect(detectPaletteNameFromColorFgBg(value)).toBe("dark");
  });
});
