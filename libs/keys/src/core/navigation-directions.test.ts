import { describe, expect, it } from "vitest";
import {
  getVerticalArrowDirection,
  isListNavigationKey,
  toVerticalBoundaryDirection,
} from "./navigation-directions.js";

describe("navigation direction helpers", () => {
  it("maps vertical arrow keys to semantic directions", () => {
    expect(getVerticalArrowDirection("ArrowUp")).toBe("up");
    expect(getVerticalArrowDirection("ArrowDown")).toBe("down");
    expect(getVerticalArrowDirection("ArrowLeft")).toBeNull();
  });

  it("maps the k/j vim aliases like the vertical arrows", () => {
    expect(getVerticalArrowDirection("k")).toBe("up");
    expect(getVerticalArrowDirection("j")).toBe("down");
    expect(getVerticalArrowDirection("ArrowLeft")).toBeNull();
    expect(getVerticalArrowDirection("ArrowRight")).toBeNull();
    expect(getVerticalArrowDirection("K")).toBeNull();
    expect(getVerticalArrowDirection("J")).toBeNull();
  });

  it("maps navigation boundaries to vertical directions", () => {
    expect(toVerticalBoundaryDirection("previous")).toBe("up");
    expect(toVerticalBoundaryDirection("next")).toBe("down");
  });

  it("ignores non-vertical triggering keys when mapping boundaries", () => {
    expect(toVerticalBoundaryDirection("previous", "ArrowLeft")).toBeNull();
    expect(toVerticalBoundaryDirection("next", "ArrowRight")).toBeNull();
    expect(toVerticalBoundaryDirection("next", "ArrowDown")).toBe("down");
  });

  it("crosses zone boundaries for the k/j vim aliases", () => {
    expect(toVerticalBoundaryDirection("previous", "k")).toBe("up");
    expect(toVerticalBoundaryDirection("next", "j")).toBe("down");
  });

  it("identifies list navigation keys", () => {
    expect(isListNavigationKey("ArrowUp")).toBe(true);
    expect(isListNavigationKey("ArrowDown")).toBe(true);
    // Vim aliases: listbox composites move the highlight with j/k.
    expect(isListNavigationKey("j")).toBe(true);
    expect(isListNavigationKey("k")).toBe(true);
    expect(isListNavigationKey("Home")).toBe(true);
    expect(isListNavigationKey("End")).toBe(true);
    expect(isListNavigationKey("Enter")).toBe(true);
    expect(isListNavigationKey(" ")).toBe(true);
    expect(isListNavigationKey("ArrowLeft")).toBe(false);
    expect(isListNavigationKey("ArrowRight")).toBe(false);
    expect(isListNavigationKey("a")).toBe(false);
    expect(isListNavigationKey("J")).toBe(false);
    expect(isListNavigationKey("Tab")).toBe(false);
  });
});
