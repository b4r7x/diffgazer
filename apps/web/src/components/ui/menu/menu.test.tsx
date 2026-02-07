import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "./menu";
import { MenuItem } from "./menu-item";
import { Fragment } from "react";

// Mock the keyboard hooks since they depend on KeyboardContext
vi.mock("@/hooks/keyboard", () => ({
  useKey: vi.fn(),
  useKeys: vi.fn(),
}));

describe("Menu", () => {
  it("should render menu items", () => {
    render(
      <Menu selectedIndex={0} onSelect={vi.fn()}>
        <MenuItem id="a">Alpha</MenuItem>
        <MenuItem id="b">Beta</MenuItem>
      </Menu>
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("should render with listbox role", () => {
    render(
      <Menu selectedIndex={0} onSelect={vi.fn()} aria-label="test menu">
        <MenuItem id="a">Item A</MenuItem>
      </Menu>
    );
    expect(screen.getByRole("listbox", { name: "test menu" })).toBeInTheDocument();
  });

  it("should handle Fragment children", () => {
    render(
      <Menu selectedIndex={0} onSelect={vi.fn()}>
        <Fragment>
          <MenuItem id="a">Frag A</MenuItem>
          <MenuItem id="b">Frag B</MenuItem>
        </Fragment>
      </Menu>
    );
    expect(screen.getByText("Frag A")).toBeInTheDocument();
    expect(screen.getByText("Frag B")).toBeInTheDocument();
  });

  it("should mark selected item with aria-selected", () => {
    render(
      <Menu selectedIndex={1} onSelect={vi.fn()}>
        <MenuItem id="a">Sel A</MenuItem>
        <MenuItem id="b">Sel B</MenuItem>
      </Menu>
    );
    const options = screen.getAllByRole("option");
    expect(options[0]?.getAttribute("aria-selected")).toBe("false");
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("should call onSelect when item is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Menu selectedIndex={0} onSelect={onSelect}>
        <MenuItem id="a">Click A</MenuItem>
        <MenuItem id="b">Click B</MenuItem>
      </Menu>
    );
    await user.click(screen.getByText("Click B"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("should not call onSelect for disabled items", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Menu selectedIndex={0} onSelect={onSelect}>
        <MenuItem id="a">Dis A</MenuItem>
        <MenuItem id="b" disabled>Dis B</MenuItem>
      </Menu>
    );
    await user.click(screen.getByText("Dis B"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("should call onActivate when item is clicked", async () => {
    const onActivate = vi.fn();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Menu selectedIndex={0} onSelect={onSelect} onActivate={onActivate}>
        <MenuItem id="a">Act A</MenuItem>
        <MenuItem id="b">Act B</MenuItem>
      </Menu>
    );
    await user.click(screen.getByText("Act B"));
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b", index: 1, disabled: false })
    );
  });
});
