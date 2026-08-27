import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { requireAttribute } from "../../testing/assertions";
import { Menu, MenuLabel } from "./index";

describe("MenuGroup and MenuLabel", () => {
  it("renders role=group with aria-labelledby when label prop is provided", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Group label="Section">
          <Menu.Item id="one">One</Menu.Item>
        </Menu.Group>
      </Menu>,
    );

    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("aria-labelledby");
    expect(screen.getByText("Section")).toBeInTheDocument();

    const labelId = requireAttribute(group, "aria-labelledby");
    const label = document.getElementById(labelId);
    expect(label).toHaveTextContent("Section");
  });

  it("renders role=group without aria-labelledby when no label prop", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Group>
          <Menu.Item id="one">One</Menu.Item>
        </Menu.Group>
      </Menu>,
    );

    const group = screen.getByRole("group");
    expect(group).not.toHaveAttribute("aria-labelledby");
  });

  it("renders MenuLabel as a standalone presentation element", () => {
    render(
      <Menu aria-label="Test menu">
        <MenuLabel>Custom Header</MenuLabel>
        <Menu.Item id="one">One</Menu.Item>
      </Menu>,
    );

    const label = screen.getByText("Custom Header");
    expect(label).toHaveAttribute("role", "presentation");
  });

  it("keyboard navigation passes through groups seamlessly", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Test menu" defaultHighlighted="one">
        <Menu.Group label="First">
          <Menu.Item id="one">One</Menu.Item>
          <Menu.Item id="two">Two</Menu.Item>
        </Menu.Group>
        <Menu.Group label="Second">
          <Menu.Item id="three">Three</Menu.Item>
        </Menu.Group>
      </Menu>,
    );

    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-three"));
  });

  it("has no a11y violations with grouped items", async () => {
    const { container } = render(
      <Menu aria-label="Test menu">
        <Menu.Group label="Actions">
          <Menu.Item id="one">One</Menu.Item>
          <Menu.Item id="two">Two</Menu.Item>
        </Menu.Group>
        <Menu.Group label="Danger zone">
          <Menu.Item id="delete" variant="danger">
            Delete
          </Menu.Item>
        </Menu.Group>
      </Menu>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
