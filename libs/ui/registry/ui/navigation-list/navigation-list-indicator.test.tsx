import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { NavigationList } from "./index";

describe("NavigationList indicator variants", () => {
  function renderWithIndicator(indicator?: "bar" | "bar-thick" | "arrow" | "bracket") {
    return render(
      <NavigationList
        aria-label="Test nav"
        selectedId="one"
        focused
        {...(indicator ? { indicator } : {})}
      >
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );
  }

  it("defaults to bar indicator", () => {
    const { container } = renderWithIndicator();
    // querySelector retained: data-indicator is a structural test hook on the indicator slot div, not an accessible element
    const slot = container.querySelector("[data-indicator]") as HTMLElement;
    expect(slot).toBeTruthy();
    expect(slot.getAttribute("data-indicator")).toBe("bar");
  });

  it("renders bar-thick indicator with wider slot", () => {
    const { container } = renderWithIndicator("bar-thick");
    // querySelector retained: data-indicator is a structural test hook on the indicator slot div
    const slots = container.querySelectorAll("[data-indicator='bar-thick']");
    expect(slots.length).toBeGreaterThan(0);
  });

  it("renders > glyph prefix on active item for arrow indicator", () => {
    renderWithIndicator("arrow");
    const activeItem = screen.getByRole("option", { name: "One" });
    expect(activeItem.textContent).toContain(">");

    const inactiveItem = screen.getByRole("option", { name: "Two" });
    expect(inactiveItem.textContent).toContain(">");
  });

  it("renders [ ] wrapping on items for bracket indicator", () => {
    renderWithIndicator("bracket");
    const activeItem = screen.getByRole("option", { name: "One" });
    expect(activeItem.textContent).toContain("[");
    expect(activeItem.textContent).toContain("]");
  });

  it("does not affect keyboard navigation when indicator changes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NavigationList
        aria-label="Test nav"
        indicator="arrow"
        defaultHighlighted="one"
        onSelect={onSelect}
      >
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("two");
  });

  it("has no a11y violations with bracket indicator", async () => {
    const { container } = renderWithIndicator("bracket");
    expect(await axe(container)).toHaveNoViolations();
  });
});
