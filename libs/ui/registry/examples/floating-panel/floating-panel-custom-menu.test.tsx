import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("focuses the first item on open, moves focus with arrow keys, closes on Escape, and restores focus after selecting an item", async () => {
    const user = userEvent.setup();
    render(<FloatingPanelCustomMenuExample />);

    const trigger = screen.getByRole("button", { name: "actions" });
    await user.click(trigger);

    const items = screen.getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(items[0]).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await waitFor(() => expect(screen.getAllByRole("menuitem")[0]).toHaveFocus());
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
