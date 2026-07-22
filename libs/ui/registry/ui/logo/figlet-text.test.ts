import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("figlet");
  vi.doUnmock("figlet/importable-fonts/Big.js");
  vi.doUnmock("figlet/importable-fonts/Small.js");
});

describe("getFigletText", () => {
  it.each([
    "Big",
    "Small",
  ] as const)("renders multi-line ASCII art through the static %s font loader", async (font) => {
    const { getFigletText } = await import("./figlet-text");

    const result = await getFigletText("OK", font);

    expect(result.split("\n").length).toBeGreaterThan(1);
    expect(result.length).toBeGreaterThan(2);
  });

  it("retries the font import after a rejected load", async () => {
    let fontLoadAttempts = 0;
    vi.doMock("figlet/importable-fonts/Big.js", async () => {
      const actual = await vi.importActual<{ default: string }>("figlet/importable-fonts/Big.js");
      return {
        get default() {
          fontLoadAttempts += 1;
          if (fontLoadAttempts === 1) {
            throw new Error("chunk load failed");
          }
          return actual.default;
        },
      };
    });

    const { getFigletText } = await import("./figlet-text");

    await expect(getFigletText("OK", "Big")).rejects.toThrow(/optional peer dependency 'figlet'/);
    const result = await getFigletText("OK", "Big");

    expect(result.split("\n").length).toBeGreaterThan(1);
  });

  it("retries the figlet import after a rejected load", async () => {
    let loadAttempts = 0;
    vi.doMock("figlet", async () => {
      return {
        get default() {
          loadAttempts += 1;
          if (loadAttempts === 1) {
            throw new Error("chunk load failed");
          }
          return {
            parseFont: vi.fn(),
            textSync: vi.fn(() => "OK\n"),
          };
        },
      };
    });

    const { getFigletText } = await import("./figlet-text");

    await expect(getFigletText("OK", "Small")).rejects.toThrow(/optional peer dependency 'figlet'/);
    const result = await getFigletText("OK", "Small");

    expect(result.length).toBeGreaterThan(2);
    expect(loadAttempts).toBe(2);
  });

  it("rejects with a clear message when the optional figlet peer is missing", async () => {
    // Boundary mock: simulates the absent optional peer dependency.
    vi.doMock("figlet", () => {
      throw new Error("Cannot find module 'figlet'");
    });

    const { getFigletText } = await import("./figlet-text");

    await expect(getFigletText("OK")).rejects.toThrow(/optional peer dependency 'figlet'/);
  });
});
