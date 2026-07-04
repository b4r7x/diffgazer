import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import FloatingPanelCustomMenuExample from "./floating-panel-custom-menu";

describe("floating-panel custom menu example", () => {
  it("exposes valid menu→menuitem ownership", async () => {
    const user = userEvent.setup();
    render(<FloatingPanelCustomMenuExample />);
    await user.click(screen.getByRole("button", { name: "actions" }));

    const menu = screen.getByRole("menu", { name: "Actions" });
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(3);
    expect(
      await axe(menu, {
        runOnly: { type: "rule", values: ["aria-required-children", "aria-required-parent"] },
      }),
    ).toHaveNoViolations();
  });

  it("moves focus across items with arrow keys and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<FloatingPanelCustomMenuExample />);

    const trigger = screen.getByRole("button", { name: "actions" });
    await user.click(trigger);

    const items = screen.getAllByRole("menuitem");
    items[0]?.focus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(items[0]).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
