import { describe, expect, it } from "vitest";
import {
  getVerticalArrowDirection,
  toVerticalBoundaryDirection,
} from "./navigation-directions";

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
});
