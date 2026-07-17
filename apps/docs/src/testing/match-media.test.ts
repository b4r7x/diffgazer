import { describe, expect, it, vi } from "vitest";
import { stubControllableMatchMedia } from "./match-media";

describe("stubControllableMatchMedia", () => {
  it("preserves old viewport snapshots and skips unchanged queries", () => {
    const viewport = stubControllableMatchMedia({ isDesktop: false });
    const minWidth = window.matchMedia("(min-width: 768px)");
    const maxWidth = window.matchMedia("(max-width: 767px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const minWidthListener = vi.fn();
    const maxWidthListener = vi.fn();
    const reducedMotionListener = vi.fn();
    minWidth.addEventListener("change", minWidthListener);
    maxWidth.addEventListener("change", maxWidthListener);
    reducedMotion.addEventListener("change", reducedMotionListener);

    viewport.setDesktop(false);
    expect(minWidthListener).not.toHaveBeenCalled();
    expect(maxWidthListener).not.toHaveBeenCalled();

    viewport.setDesktop(true);

    expect(minWidth.matches).toBe(true);
    expect(maxWidth.matches).toBe(false);
    expect(minWidthListener).toHaveBeenCalledTimes(1);
    expect(maxWidthListener).toHaveBeenCalledTimes(1);
    expect(minWidthListener).toHaveBeenLastCalledWith(expect.objectContaining({ matches: true }));
    expect(maxWidthListener).toHaveBeenLastCalledWith(expect.objectContaining({ matches: false }));
    expect(reducedMotionListener).not.toHaveBeenCalled();

    viewport.setDesktop(true);
    expect(minWidthListener).toHaveBeenCalledTimes(1);
    expect(maxWidthListener).toHaveBeenCalledTimes(1);

    viewport.setDesktop(false);
    expect(minWidth.matches).toBe(false);
    expect(maxWidth.matches).toBe(true);
    expect(minWidthListener).toHaveBeenCalledTimes(2);
    expect(maxWidthListener).toHaveBeenCalledTimes(2);
    expect(minWidthListener).toHaveBeenLastCalledWith(expect.objectContaining({ matches: false }));
    expect(maxWidthListener).toHaveBeenLastCalledWith(expect.objectContaining({ matches: true }));
    expect(reducedMotionListener).not.toHaveBeenCalled();
  });
});
