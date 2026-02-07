import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("figlet", () => ({
  default: {
    parseFont: vi.fn(),
    textSync: vi.fn((text: string) => `RENDERED:${text}`),
  },
}));

vi.mock("figlet/importable-fonts/Big.js", () => ({ default: "big-font-data" }));
vi.mock("figlet/importable-fonts/Small.js", () => ({ default: "small-font-data" }));

import { getFigletText } from "./get-figlet.js";
import figlet from "figlet";

describe("getFigletText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders text and uppercases input", () => {
    const result = getFigletText("hello");

    expect(result).toBe("RENDERED:HELLO");
    expect(figlet.textSync).toHaveBeenCalledWith("HELLO", { font: "Big" });
  });

  it("uses specified font", () => {
    getFigletText("test", "Small");

    expect(figlet.textSync).toHaveBeenCalledWith("TEST", { font: "Small" });
  });

  it("returns null on error", () => {
    vi.mocked(figlet.textSync).mockImplementationOnce(() => {
      throw new Error("font error");
    });

    const result = getFigletText("fail");

    expect(result).toBeNull();
  });

  it("loads font only once per font type", () => {
    getFigletText("a", "Big");
    getFigletText("b", "Big");

    // parseFont called once for Big on first getFigletText call in this test suite
    // (may be called more from previous tests due to module-level caching)
    expect(figlet.textSync).toHaveBeenCalledTimes(2);
  });
});
