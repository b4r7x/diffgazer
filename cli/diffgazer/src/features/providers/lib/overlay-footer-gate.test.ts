import { describe, expect, it } from "vitest";
import { isOverlayFooterNavActive } from "./overlay-footer-gate";

describe("isOverlayFooterNavActive", () => {
  it("is active when the overlay is open and the input is not focused", () => {
    expect(isOverlayFooterNavActive({ open: true, saving: false, inputFocused: false })).toBe(true);
  });

  it("is inactive while the key input is focused so arrows cannot move to Cancel", () => {
    expect(isOverlayFooterNavActive({ open: true, saving: false, inputFocused: true })).toBe(false);
  });

  it("is inactive while saving or closed", () => {
    expect(isOverlayFooterNavActive({ open: true, saving: true, inputFocused: false })).toBe(false);
    expect(isOverlayFooterNavActive({ open: false, saving: false, inputFocused: false })).toBe(
      false,
    );
  });
});
