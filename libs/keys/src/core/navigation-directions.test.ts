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

  it("maps navigation boundaries to vertical directions", () => {
    expect(toVerticalBoundaryDirection("previous")).toBe("up");
    expect(toVerticalBoundaryDirection("next")).toBe("down");
  });

  it("ignores non-vertical triggering keys when mapping boundaries", () => {
    expect(toVerticalBoundaryDirection("previous", "ArrowLeft")).toBeNull();
    expect(toVerticalBoundaryDirection("next", "ArrowRight")).toBeNull();
    expect(toVerticalBoundaryDirection("next", "ArrowDown")).toBe("down");
  });

  it("identifies list navigation keys", () => {
    expect(isListNavigationKey("ArrowUp")).toBe(true);
    expect(isListNavigationKey("ArrowDown")).toBe(true);
    expect(isListNavigationKey("Home")).toBe(true);
    expect(isListNavigationKey("End")).toBe(true);
    expect(isListNavigationKey("Enter")).toBe(true);
    expect(isListNavigationKey(" ")).toBe(true);
    expect(isListNavigationKey("ArrowLeft")).toBe(false);
    expect(isListNavigationKey("ArrowRight")).toBe(false);
    expect(isListNavigationKey("a")).toBe(false);
    expect(isListNavigationKey("Tab")).toBe(false);
  });
});
