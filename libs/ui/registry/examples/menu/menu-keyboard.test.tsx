import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import MenuKeyboard from "./menu-keyboard";

describe("menu-keyboard example", () => {
  it("keeps j/k navigation working immediately after a numeric shortcut", async () => {
    const user = userEvent.setup();
    render(<MenuKeyboard />);

    const menu = screen.getByRole("menu", { name: "File actions" });
    await user.click(menu);

    const newItem = screen.getByRole("menuitemradio", { name: /^New File$/ });
    expect(menu).toHaveAttribute("aria-activedescendant", newItem.id);

    await user.keyboard("1j");
    const openItem = screen.getByRole("menuitemradio", { name: /^Open File$/ });
    expect(menu).toHaveAttribute("aria-activedescendant", openItem.id);
  });
});
