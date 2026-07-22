import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemePreviewCard } from "./preview-card";

describe("ThemePreviewCard", () => {
  it("marks the mock menu subtree inert so it is out of keyboard/AT reach", () => {
    render(<ThemePreviewCard previewTheme="dark" />);

    const menu = screen.getByRole("menu");
    expect(menu.closest("[inert]")).not.toBeNull();
  });
});
