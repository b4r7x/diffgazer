import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { describe, expect, it } from "vitest";
import { chromeReturnShortcut } from "@/components/layout/header-chrome";
import { getHistoryFooter } from "./footer";

const NO_LISTS = { hasMore: false, hasListRetry: false };

describe("getHistoryFooter parked on the chrome", () => {
  it("names the region ArrowDown returns to", () => {
    expect(
      getHistoryFooter("chrome", { ...NO_LISTS, chromeReturnZone: "search" }).shortcuts,
    ).toEqual([{ key: "↓", label: "Search" }]);

    expect(
      getHistoryFooter("chrome", { ...NO_LISTS, chromeReturnZone: "warnings" }).shortcuts,
    ).toEqual([{ key: "↓", label: "Warnings" }]);
  });

  it("advertises no return when the Back button was reached without a hand-off", () => {
    const footer = getHistoryFooter("chrome", {
      hasMore: true,
      hasListRetry: false,
      chromeReturnZone: null,
    });

    // The screen-wide accelerator stays; the arrow that has nowhere to go does not.
    expect(footer.shortcuts).toEqual([{ key: "l", label: "Load Older Runs" }]);
    expect(footer.rightShortcuts).toEqual([BACK_SHORTCUT]);
  });
});

// The rule every screen parked on the chrome shares; history's footer is one of
// its three callers.
describe("chromeReturnShortcut", () => {
  type Zone = "input" | "notice" | "list";
  const LABELS: Partial<Record<Zone, string>> = { input: "Search", notice: "Retry" };

  it("names the zone the arrow returns to", () => {
    expect(chromeReturnShortcut("input", LABELS)).toEqual([{ key: "↓", label: "Search" }]);
    expect(chromeReturnShortcut("notice", LABELS)).toEqual([{ key: "↓", label: "Retry" }]);
  });

  it("names nothing without a memory or a label", () => {
    expect(chromeReturnShortcut(null, LABELS)).toEqual([]);
    expect(chromeReturnShortcut("list", LABELS)).toEqual([]);
  });
});
