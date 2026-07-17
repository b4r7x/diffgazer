import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Menu } from "./index";

it("keeps a disabled highlighted SubTrigger discoverable without enabled styling or activation", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  const onSelect = vi.fn();
  const { container } = render(
    <Menu aria-label="Test menu" highlighted="more" onSelect={onSelect}>
      <Menu.Sub open={false} onOpenChange={onOpenChange}>
        <Menu.SubTrigger id="more" disabled>
          More
        </Menu.SubTrigger>
        <Menu.SubContent>
          <Menu.Item id="details">Details</Menu.Item>
        </Menu.SubContent>
      </Menu.Sub>
    </Menu>,
  );
  const menu = screen.getByRole("menu");
  const trigger = screen.getByRole("menuitem", { name: "More" });

  expect(menu).toHaveAttribute("aria-activedescendant", trigger.id);
  expect(trigger).toHaveAttribute("aria-disabled", "true");
  expect(trigger).toHaveAttribute("data-highlighted");
  expect(trigger).toHaveClass("cursor-not-allowed", "bg-secondary", "text-foreground");
  expect(trigger).not.toHaveClass("bg-primary", "text-primary-foreground");

  menu.focus();
  await user.keyboard("{Enter}{ArrowRight}");
  await user.click(trigger);

  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(onSelect).not.toHaveBeenCalled();
  expect(await axe(container)).toHaveNoViolations();
});
