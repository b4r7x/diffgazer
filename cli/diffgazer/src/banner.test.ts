import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getFigletText = vi.hoisted(() => vi.fn(() => "wide banner"));
vi.mock("./lib/get-figlet", () => ({ getFigletText }));

import { printDiffgazerBanner } from "./banner";

describe("printDiffgazerBanner", () => {
  beforeEach(() => {
    getFigletText.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the figlet banner when all 64 columns fit", () => {
    printDiffgazerBanner(64);

    expect(getFigletText).toHaveBeenCalledWith("DIFFGAZER");
    expect(console.log).toHaveBeenNthCalledWith(1, "wide banner");
  });

  it("uses the plain name in a narrower terminal", () => {
    printDiffgazerBanner(63);

    expect(getFigletText).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenNthCalledWith(1, "DIFFGAZER");
  });
});
