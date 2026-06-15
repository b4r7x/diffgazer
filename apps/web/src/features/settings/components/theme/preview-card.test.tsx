import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemePreviewCard } from "./preview-card";

describe("ThemePreviewCard", () => {
  it("marks the mock menu subtree inert so it is out of keyboard/AT reach", () => {
    render(<ThemePreviewCard previewTheme="dark" />);

    const menu = screen.getByRole("menu");
    expect(menu.closest("[inert]")).not.toBeNull();
  });

  it("places the focusable menu container inside the inert subtree so it is not tab-reachable", () => {
    const { container } = render(<ThemePreviewCard previewTheme="dark" />);

    // useListbox gives the menu container tabIndex 0; the inert wrapper must
    // contain it so a conformant UA skips the whole decorative preview.
    const tabbable = container.querySelector('[tabindex="0"]');
    expect(tabbable).not.toBeNull();
    expect(tabbable?.closest("[inert]")).not.toBeNull();
  });
});
