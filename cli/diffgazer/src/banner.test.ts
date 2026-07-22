import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { printDiffgazerBanner } from "./banner";
import { getFigletText } from "./lib/get-figlet";

describe("printDiffgazerBanner", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the figlet banner when all 64 columns fit", () => {
    printDiffgazerBanner(64);

    const figletBanner = getFigletText("DIFFGAZER");
    expect(figletBanner).not.toBeNull();

    const firstLog = vi.mocked(console.log).mock.calls[0]?.[0];
    expect(firstLog).toBe(figletBanner);
    expect(typeof firstLog).toBe("string");
    expect(firstLog).not.toBe("DIFFGAZER");
    expect(String(firstLog).includes("\n")).toBe(true);
    expect(vi.mocked(console.log).mock.calls[1]).toEqual([]);
  });

  it("uses the plain name in a narrower terminal", () => {
    printDiffgazerBanner(63);

    expect(console.log).toHaveBeenNthCalledWith(1, "DIFFGAZER");
    expect(vi.mocked(console.log).mock.calls[1]).toEqual([]);
  });
});
