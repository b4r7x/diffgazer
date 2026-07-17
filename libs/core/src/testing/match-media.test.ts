/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { stubControllableMatchMedia } from "./match-media.js";

describe("stubControllableMatchMedia", () => {
  it("notifies only media queries whose match changed", () => {
    const controller = stubControllableMatchMedia((query) => query === "(stable)");
    const stable = window.matchMedia("(stable)");
    const changing = window.matchMedia("(changing)");
    const stableListener = vi.fn();
    const changingListener = vi.fn();
    stable.addEventListener("change", stableListener);
    changing.addEventListener("change", changingListener);

    controller.setMatches((query) => query === "(stable)");
    expect(stableListener).not.toHaveBeenCalled();
    expect(changingListener).not.toHaveBeenCalled();

    controller.setMatches(() => true);
    expect(stableListener).not.toHaveBeenCalled();
    expect(changingListener).toHaveBeenCalledWith(
      expect.objectContaining({ matches: true, media: "(changing)" }),
    );
  });
});
